'use strict';

// Default settings
const settingsDefault = {
  cacheLifetime: 60 * 24 * 7
};
// Base data structure
const dataBase = {
  // https://www.pathofexile.com/api/trade/data/leagues
  leagues: null,
  // https://www.pathofexile.com/api/trade/data/static
  cards: null,
  currency: null,
  mapsBase: null,
  mapsElder: null,
  essences: null,
  fossils: null,
  fragments: null,
  incubators: null,
  leaguestones: null,
  resonators: null,
  scarabs: null,
  vials: null,
  // https://www.pathofexile.com/api/trade/data/stats
  stats: null
};

// Nodejs dependencies
const request = require('request');

// Internal dependencies
const CachedStorage = require('./cached-storage.js');

class PoeTradeApiReader extends CachedStorage {
  constructor(settings) {
    super(Object.assign({}, settingsDefault, settings, { ident: "trade-api" }));
    // Ensure data structures are present
    this.data = Object.assign({}, dataBase, this.data);
  }
  handleLeagues(apiData) {
    // Leagues
    this.data.leagues = {};
    for (let leagueIndex = 0; leagueIndex < apiData.result.length; leagueIndex++) {
      let leagueData = apiData.result[leagueIndex];
      this.data.leagues[leagueData.id] = leagueData.text;
    }
  }
  handleStatic(apiData) {
    // Cards
    this.data.cards = {};
    for (let cardIndex = 0; cardIndex < apiData.result.cards.length; cardIndex++) {
      let cardData = apiData.result.cards[cardIndex];
      this.data.cards[cardData.id] = cardData.text;
    }
    // Currency
    this.data.currency = {};
    for (let currencyIndex = 0; currencyIndex < apiData.result.currency.length; currencyIndex++) {
      let currencyData = apiData.result.currency[currencyIndex];
      this.data.currency[currencyData.id] = currencyData.text;
    }
    // Maps
    this.data.mapsBase = {};
    this.data.mapsElder = {};
    for (let mapIndex = 0; mapIndex < apiData.result.maps.length; mapIndex++) {
      let mapData = apiData.result.maps[mapIndex];
      this.data.mapsBase[mapData.id] = mapData.text;
    }
    for (let mapIndex = 0; mapIndex < apiData.result.elder_maps.length; mapIndex++) {
      let mapData = apiData.result.elder_maps[mapIndex];
      this.data.mapsElder[mapData.id] = mapData.text;
    }
    // Essences
    this.data.essences = {};
    for (let essenceIndex = 0; essenceIndex < apiData.result.essences.length; essenceIndex++) {
      let essenceData = apiData.result.essences[essenceIndex];
      this.data.essences[essenceData.id] = essenceData.text;
    }
    // Fossils
    this.data.fossils = {};
    for (let fossilIndex = 0; fossilIndex < apiData.result.fossils.length; fossilIndex++) {
      let fossilData = apiData.result.fossils[fossilIndex];
      this.data.fossils[fossilData.id] = fossilData.text;
    }
    // Fragments
    this.data.fragments = {};
    for (let fragmentIndex = 0; fragmentIndex < apiData.result.fragments.length; fragmentIndex++) {
      let fragmentData = apiData.result.fragments[fragmentIndex];
      this.data.fragments[fragmentData.id] = fragmentData.text;
    }
    // Incubators
    this.data.incubators = {};
    for (let incubatorIndex = 0; incubatorIndex < apiData.result.incubators.length; incubatorIndex++) {
      let incubatorData = apiData.result.incubators[incubatorIndex];
      this.data.incubators[incubatorData.id] = incubatorData.text;
    }
    // Leaguestones
    this.data.leaguestones = {};
    for (let leaguestoneIndex = 0; leaguestoneIndex < apiData.result.leaguestones.length; leaguestoneIndex++) {
      let leaguestoneData = apiData.result.leaguestones[leaguestoneIndex];
      this.data.leaguestones[leaguestoneData.id] = leaguestoneData.text;
    }
    // Resonators
    this.data.resonators = {};
    for (let resonatorIndex = 0; resonatorIndex < apiData.result.resonators.length; resonatorIndex++) {
      let resonatorData = apiData.result.resonators[resonatorIndex];
      this.data.resonators[resonatorData.id] = resonatorData.text;
    }
    // Scarabs
    this.data.scarabs = {};
    for (let scarabIndex = 0; scarabIndex < apiData.result.scarabs.length; scarabIndex++) {
      let scarabData = apiData.result.scarabs[scarabIndex];
      this.data.scarabs[scarabData.id] = scarabData.text;
    }
    // Vials
    this.data.vials = {};
    for (let vialIndex = 0; vialIndex < apiData.result.vials.length; vialIndex++) {
      let vialData = apiData.result.vials[vialIndex];
      this.data.vials[vialData.id] = vialData.text;
    }
  }
  handleStats(apiData) {
    // Leagues
    this.data.stats = {};
    for (let statTypeIndex = 0; statTypeIndex < apiData.result.length; statTypeIndex++) {
      let statTypeData = apiData.result[statTypeIndex];
      this.data.stats[statTypeData.label] = {};
      for (let entryIndex = 0; entryIndex < statTypeData.entries.length; entryIndex++) {
        let entryData = statTypeData.entries[entryIndex];
        this.data.stats[statTypeData.label][entryData.id] = entryData.text;
      }
    }
  }
  updateApiData(dataType) {
    let url = "https://www.pathofexile.com/api/trade/data/"+dataType;
    return new Promise((resolve, reject) => {
      request({
        'method': 'GET',
        'uri': url,
        'json': true,
      }, (error, response, body) => {
          if (error) reject(error);
          if (response.statusCode !== 200) {
              reject('Invalid status code <' + response.statusCode + '>');
          }
          resolve(body);
      });
    });
  }
  async refresh() {
    // Check cache for wiki data
    if (!this.isCacheValid(this.settings["cacheLifetime"])) {
      this.invokeCallback("update-start");
      let promiseLeagues = this.updateApiData("leagues");
      let promiseStatic = this.updateApiData("static");
      let promiseStats = this.updateApiData("stats");
      this.handleLeagues(await promiseLeagues);
      this.handleStatic(await promiseStatic);
      this.handleStats(await promiseStats);
      this.writeCache();
      this.invokeCallback("update-done");
    }
  }
}

module.exports = PoeTradeApiReader;
