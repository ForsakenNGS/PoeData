'use strict';

// Local dependencies
const CallbackHandler = require("./callback-handler.js");
const Helpers = require('./helpers.js');
const PoeTradeApiReader = require('./poe-trade-api-reader.js');
const PoeWikiReader = require('./poe-wiki-reader.js');

class PoeData extends CallbackHandler {
  constructor(settings) {
    super();
    // Constants
    this.constantsInit();
    // Initialize fields
    this.updateActive = false;
    // Readers
    this.tradeApiReader = new PoeTradeApiReader(settings);
    this.wikiReader = new PoeWikiReader(settings);
    // Forward callbacks
    let self = this;
    // -> Trade Api
    this.tradeApiReader.registerCallback("update-start", () => {
      self.invokeCallback("update-start", "trade-api");
    });
    this.tradeApiReader.registerCallback("update-done", () => {
      self.invokeCallback("update-done", "trade-api");
    });
    // -> Wiki
    this.wikiReader.registerCallback("update-start", () => {
      self.invokeCallback("update-start", "wiki");
    });
    this.wikiReader.registerCallback("update-status", (subType, index) => {
      self.invokeCallback("update-status", "wiki", subType, index);
    });
    this.wikiReader.registerCallback("update-done", () => {
      self.invokeCallback("update-done", "wiki");
    });
    this.wikiReader.registerCallback("process-wiki-data", (table, data) => {
      self.invokeCallback("process-wiki-data", table, data);
      switch (table) {
        case "items":
          data['description'] = Helpers.decodeHtml(data['description']);
          data['stat text'] = Helpers.decodeHtml(data['stat text']);
          data['help text'] = Helpers.decodeHtml(data['help text']);
          data['flavour text'] = Helpers.decodeHtml(data['flavour text']);
          data['tags'] = (data['tags'] === "" ? [] : data['tags'].split(","));
          data['mods'] = [];
          data['stats'] = [];
          break;
        case "mods":
          data['trade text'] = self.getTradeText(data['stat text raw']);
          data['trade limits'] = self.getTradeLimits(data['stat text raw']);
          data['trade ids'] = self.getTradeIds(data['trade text']);
          data['tags'] = (data['tags'] === "" ? [] : data['tags'].split(","));
          data['stats'] = [];
          data['spawnWeights'] = [];
          break;
      }
    });
    
  }
  changeSettings(settings) {
    this.tradeApiReader.changeSettings(settings);
    this.wikiReader.changeSettings(settings);
  }
  constantsInit() {
    // Mod domains
    this.MOD_DOMAIN_ITEM = 1;
    this.MOD_DOMAIN_FLASK = 2;
    this.MOD_DOMAIN_MONSTER = 3;
    this.MOD_DOMAIN_CHEST = 4;
    this.MOD_DOMAIN_AREA = 5;
    this.MOD_DOMAIN_UNKNOWN6 = 6;
    this.MOD_DOMAIN_UNKNOWN7 = 7;
    this.MOD_DOMAIN_UNKNOWN8 = 8;
    this.MOD_DOMAIN_CRAFTED = 9;
    this.MOD_DOMAIN_JEWEL = 10;
    this.MOD_DOMAIN_ATLAS = 11;
    this.MOD_DOMAIN_LEAGUESTONE = 12;
    this.MOD_DOMAIN_ABYSS_JEWEL = 13;
    this.MOD_DOMAIN_MAP_DEVICE = 14;
    this.MOD_DOMAIN_UNKNOWN15 = 15;
    this.MOD_DOMAIN_DELVE = 16;
    this.MOD_DOMAIN_DELVE_AREA = 17;
    this.MOD_DOMAIN_SYNTHESIS18 = 18;
    this.MOD_DOMAIN_SYNTHESIS19 = 19;
    this.MOD_DOMAIN_SYNTHESIS20 = 20;
    // Mod generation types
    this.MOD_GEN_TYPE_PREFIX = 1;
    this.MOD_GEN_TYPE_SUFFIX = 2;
    this.MOD_GEN_TYPE_UNIQUE = 3;
    this.MOD_GEN_TYPE_NEMESIS = 4;
    this.MOD_GEN_TYPE_CORRUPTED = 5;
    this.MOD_GEN_TYPE_BLOODLINES = 6;
    this.MOD_GEN_TYPE_TORMENT = 7;
    this.MOD_GEN_TYPE_TEMPEST = 8;
    this.MOD_GEN_TYPE_TALISMAN = 9;
    this.MOD_GEN_TYPE_ENCHANTMENT = 10;
    this.MOD_GEN_TYPE_ESSENCE = 11;
    this.MOD_GEN_TYPE_UNKNOWN12 = 12;
    this.MOD_GEN_TYPE_BESTIARY = 13;
    this.MOD_GEN_TYPE_DELVE = 14;
    this.MOD_GEN_TYPE_SYNTHESIS15 = 15;
    this.MOD_GEN_TYPE_SYNTHESIS16 = 16;
    this.MOD_GEN_TYPE_SYNTHESIS17 = 17;
  }
  
  
  async refresh() {
    this.updateActive = true;
    await this.tradeApiReader.refresh();
    await this.wikiReader.refresh();
    this.updateActive = false;
  }
  getTradeText(rawText) {
    return Helpers.decodeHtml(rawText).replace(/\+?\([0-9\-.]+\)/g, "#");
  }
  getTradeLimits(rawText) {
    let matchLimits = false;
    let lines = Helpers.decodeHtml(rawText).split("\n");
    let result = [];
    for (let l = 0; l < lines.length; l++) {
      let resultLine = [];
      let regExpLimits = /\+?\(([0-9\-.]+)\)/g;
      while (matchLimits = regExpLimits.exec(lines[l])) {
        resultLine.push(matchLimits[1].split("-"));
      }
      result.push(resultLine);
    }
    return result;
  }
  getTradeIds(text) {
    if (text === "") {
      return [];
    }
    let tradeIds = [];
    let lines = text.split("\n");
    for (let l = 0; l < lines.length; l++) {
      let lineTradeIds = [];
      // Look for exact matches
      for (let statType in this.tradeApiReader.data.stats) {
        for (let statId in this.tradeApiReader.data.stats[statType]) {
          if (lines[l] === this.tradeApiReader.data.stats[statType][statId]) {
            lineTradeIds.push(statId);
          }
        }
      }
      if (lineTradeIds.length === 0) {
        // Check more tolerant matches
        let tradeRegExpText = Helpers.escapeRegExpString(lines[l])
          .replace(/(\\\+)?([0-9]+)/g, "(\\+?#|\\+?$2)")
          .replace(/reduced/g, "(increased|reduced)")
          .replace(/seconds?/g, "seconds?");
        let tradeRegExp = new RegExp("^"+tradeRegExpText+"( \\([^\\s]+\\))?$", "i");
        for (let statType in this.tradeApiReader.data.stats) {
          for (let statId in this.tradeApiReader.data.stats[statType]) {
            if (this.tradeApiReader.data.stats[statType][statId].match(tradeRegExp)) {
              lineTradeIds.push(statId);
            }
          }
        }
      }
      tradeIds.push(lineTradeIds);
    }
    return tradeIds;
  }
  getMaps(mapType) {
    if (typeof mapType === "undefined") {
      mapType = "Base";
    }
    switch (mapType) {
      default:
      case "Base":
        return this.tradeApiReader.data.mapsBase;
      case "Elder":
        return this.tradeApiReader.data.mapsElder;
    }
  }  
  getItemBase(itemBaseName, armourTag) {
    let itemBaseIds = this.wikiReader.data.items.byName[itemBaseName];
    if (typeof itemBaseIds === "undefined") {
      // Item most likely has a prefix and/or suffix attached to the name, find the best match
      let itemSearchBestName = "";
      let itemSearchBestId = null;
      for (let itemSearchName in this.wikiReader.data.items.byName) {
        if ((itemBaseName.indexOf(itemSearchName) >= 0) && (itemSearchName.length > itemSearchBestName.length)) {
          itemSearchBestName = itemSearchName;
          itemSearchBestId = this.wikiReader.data.items.byName[itemSearchName];
        }
      }
      itemBaseIds = itemSearchBestId;
    }
    if (itemBaseIds.length === 1) {
      return this.wikiReader.data.items.byId[itemBaseIds[0]];
    } else if (itemBaseIds.length > 1) {
      let itemBaseResult = null;
      // Multiple items found! Pick the matching one.
      for (let i = 0; i < itemBaseIds.length; i++) {
        let itemBase = this.wikiReader.data.items.byId[itemBaseIds[i]];
        if (armourTag !== null) {
          if (itemBase.tags.indexOf(armourTag) === -1) {
            // Item does not match the expected type of armour, ignore this one.
            continue;
          }
        }
        itemBaseResult = itemBase;
        break;
      }
      return itemBaseResult;
    }
    return null;
  }
  getModById(modId) {
    if (this.wikiReader.data.mods.byId.hasOwnProperty(modId)) {
      return this.wikiReader.data.mods.byId[ modId ];
    } else {
      return null;
    }
  }
  getModByIdent(modIdent) {
    let modId = this.wikiReader.data.mods.byModIdent[ modIdent ];
    return this.getModById(modId);
  }
  getModsById(modIds) {
    // Resolve ids into mods
    let mods = [];
    for (let m = 0; m < modIds.length; m++) {
      mods.push( this.getModById(modIds[m]) );
    }
    return mods;
  }
  getModsByParams(params) {
    let modIds = null;
    if (params.hasOwnProperty("domains")) {
      // Get mods by domains
      // https://pathofexile.gamepedia.com/Modifiers#Mod_Domain
      let modsByDomains = [];
      for (let i = 0; i < params.domains.length; i++) {
        modsByDomains.push(...this.wikiReader.data.mods.byDomain[ params.domains[i] ]);
      }
      // Remove duplicates
      modsByDomains = [...new Set(modsByDomains)];
      // Set or filter result list
      modIds = (modIds === null ? modsByDomains : modsByDomains.filter(value => modIds.includes(value)));
    }
    if (params.hasOwnProperty("generations")) {
      // Get mods by generation types
      // https://pathofexile.gamepedia.com/Modifiers#Mod_Generation_Type
      let modsByGenerations = [];
      for (let i = 0; i < params.generations.length; i++) {
        modsByGenerations.push(...this.wikiReader.data.mods.byGeneration[ params.generations[i] ]);
      }
      // Remove duplicates
      modsByGenerations = [...new Set(modsByGenerations)];
      // Set or filter result list
      modIds = (modIds === null ? modsByGenerations : modsByGenerations.filter(value => modIds.includes(value)));
    }
    if (params.hasOwnProperty("spawnTags")) {
      // Get mods by spawn tags
      // https://pathofexile.gamepedia.com/Modifiers#Tags
      let modsBySpawnTags = [];
      for (let i = 0; i < params.spawnTags.length; i++) {
        if (!this.wikiReader.data.mods.bySpawnTags.hasOwnProperty(params.spawnTags[i])) {
          // Skip unknown tags
          continue;
        }
        for (let m = 0; m < this.wikiReader.data.mods.bySpawnTags[ params.spawnTags[i] ].length; m++) {
          modsBySpawnTags.push(this.wikiReader.data.mods.bySpawnTags[ params.spawnTags[i] ][m].modId);
        }
      }
      // Remove duplicates
      modsBySpawnTags = [...new Set(modsBySpawnTags)];
      // Set or filter result list
      modIds = (modIds === null ? modsBySpawnTags : modsBySpawnTags.filter(value => modIds.includes(value)));
    }
    return this.getModsById(modIds);
  }
  getModTradeById(modTradeId, statType) {
    if (this.tradeApiReader.data.stats[statType].hasOwnProperty(modTradeId)) {
      let modTrade = this.tradeApiReader.data.stats[statType][modTradeId];
      return { id: modTradeId, text: modTrade };
    } else {
      return null;
    }
  }
  getCurrencyName(currencyIdent) {
    if (this.tradeApiReader.data.currency.hasOwnProperty(currencyIdent)) {
      return this.tradeApiReader.data.currency[currencyIdent];
    } else {
      return null;
    }
  }
  getCurrencyItemText(currencyIdent, amount) {
    let currencyName = this.getCurrencyName(currencyIdent);
    let currencyItem = this.getItemBase(currencyName);
    let currencyText = [];
    currencyText.push("Rarity: Currency");
    currencyText.push(currencyName);
    currencyText.push("--------");
    currencyText.push("Stack Size: "+amount+"/10");
    currencyText.push("--------");
    currencyText.push(Helpers.decodeHtml(currencyItem['description']));
    currencyText.push("--------");
    currencyText.push(Helpers.decodeHtml(currencyItem['help text']));
    return currencyText.join("\n");
  }
  isUpdating() {
    return this.updateActive;
  }
}

module.exports = new PoeData({});
