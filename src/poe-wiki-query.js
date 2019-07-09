'use strict';

class PoeWikiQuery {
  constructor(table) {
    this.tables = [ table ];
    this.joinOn = [];
    this.fields = [];
    this.where = [];
    this.groupBy = [];
    this.having = [];
    this.orderBy = [];
    this.limit = null;
    this.offset = null;
  }
  addField(name, alias, noError) {
    if (this.checkDuplicateField(name, alias)) {
      if ((typeof noError !== "undefined") && noError) {
        return this;
      }
      throw new Error("Duplicate field name in query! ("+name+" / "+alias+")");
    }
    let field = { name: name };
    if ((typeof alias !== "undefined") && (alias !== null)) {
      field.alias = alias;
    }
    this.fields.push(field);
    return this;
  }
  addFields(fieldList, noError) {
    for (let i = 0; i < fieldList.length; i++) {
      let field = fieldList[i].split("=");
      if (field.length === 1) {
        this.addField(field[0], null, noError);
      } else {
        this.addField(field[0], field[1], noError);
      }
    }
    return this;
  }
  addJoin(table, joinOn, noError) {
    if (this.checkDuplicateJoin(table)) {
      if ((typeof noError !== "undefined") && noError) {
        return this;
      }
      throw new Error("Table already joined!")
    }
    this.tables.push(table);
    this.joinOn.push(joinOn);
    return this;
  }
  addWhere(condition) {
    this.where.push(condition);
    return this;
  }
  addGroupBy(field, noError) {
    if (this.checkDuplicateGroup(field)) {
      if ((typeof noError !== "undefined") && noError) {
        return this;
      }
      throw new Error("Already grouped by field '"+field+"'!")
    }
    this.groupBy.push(field);
    return this;
  }
  addHaving(condition) {
    this.having.push(condition);
    return this;
  }
  addOrderBy(field, direction, noError) {
    if (this.checkDuplicateOrder(field)) {
      if ((typeof noError !== "undefined") && noError) {
        return this;
      }
      throw new Error("Already grouped by field '"+field+"'!")
    }
    let order = { name: name };
    if ((typeof direction !== "undefined") && (direction !== null)) {
      order.direction = direction;
    }
    this.orderBy.push(order);
    return this;
  }
  build() {
    let query = { "tables": this.buildTables() };
    if (this.joinOn.length > 0) {
      query["join on"] = this.buildJoinOn();
    }
    if (this.fields.length > 0) {
      query["fields"] = this.buildFields();
    }
    if (this.where.length > 0) {
      query["where"] = this.buildWhere();
    }
    if (this.groupBy.length > 0) {
      query["group by"] = this.buildGroupBy();
    }
    if (this.having.length > 0) {
      query["having"] = this.buildHaving();
    }
    if (this.orderBy.length > 0) {
      query["order by"] = this.buildOrderBy();
    }
    if (this.limit !== null) {
      query["limit"] = this.limit;
    }
    if (this.offset !== null) {
      query["offset"] = this.offset;
    }
    return query;
  }
  buildTables() {
    return this.tables.join(",");
  }
  buildJoinOn() {
    return this.joinOn.join(",");
  }
  buildFields() {
    let fields = [];
    for (let i = 0; i < this.fields.length; i++) {
      if (this.fields[i].hasOwnProperty("alias")) {
        fields.push(this.fields[i].name+"="+this.fields[i].alias);
      } else {
        fields.push(this.fields[i].name);
      }
    }
    return fields.join(",");
  }
  buildWhere() {
    return this.where.join(" AND ");
  }
  buildGroupBy() {
    return this.groupBy.join(",");
  }
  buildHaving() {
    return this.having.join(" AND ");
  }
  buildOrderBy() {
    let order = [];
    for (let i = 0; i < this.orderBy.length; i++) {
      if (this.orderBy[i].hasOwnProperty("direction")) {
        fields.push(this.orderBy[i].name+" "+this.orderBy[i].direction);
      } else {
        fields.push(this.orderBy[i].name);
      }
    }
    return order.join(",");
  }
  checkDuplicateJoin(table) {
    return (this.tables.indexOf(table) >= 0);
  }
  checkDuplicateField(name, alias) {
    if (typeof alias !== "undefined") {
      return this.checkDuplicateField(alias);
    }
    for (let i = 0; i < this.fields.length; i++) {
      if (this.fields[i].hasOwnProperty("alias")) {
        if (this.fields[i].alias === name) {
          return true;
        }
      } else {
        if (this.fields[i].name === name) {
          return true;
        }
      }
    }
    return false;
  }
  checkDuplicateGroup(field) {
    return (this.groupBy.indexOf(field) >= 0);
  }
  checkDuplicateOrder(name) {
    for (let i = 0; i < this.orderBy.length; i++) {
      if (this.orderBy[i].name === name) {
        return true;
      }
    }
    return false;
  }
  setLimit(limit, offset) {
    this.limit = limit;
    if (typeof offset !== "undefined") {
      this.offset = offset;
    }
    return this;
  }
  setOffset(offset) {
    this.offset = offset;
    return this;
  }
}

module.exports = PoeWikiQuery;
