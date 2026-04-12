// Lightweight Entity-Component-System
// Entities are just IDs. Components are plain objects stored by name.

export class World {
  constructor() {
    this.nextId = 0;
    this.entities = new Map();     // id -> Set of component names
    this.components = new Map();   // componentName -> Map(id -> data)
    this.dead = [];
  }

  create() {
    const id = this.nextId++;
    this.entities.set(id, new Set());
    return id;
  }

  add(id, name, data) {
    if (!this.entities.has(id)) return this;
    this.entities.get(id).add(name);
    if (!this.components.has(name)) {
      this.components.set(name, new Map());
    }
    this.components.get(name).set(id, data);
    return this;
  }

  get(id, name) {
    const store = this.components.get(name);
    return store ? store.get(id) : undefined;
  }

  has(id, name) {
    const store = this.components.get(name);
    return store ? store.has(id) : false;
  }

  // Returns array of [id, comp1, comp2, ...] for entities that have ALL listed components
  query(...names) {
    const results = [];
    if (names.length === 0) return results;

    // Start with the smallest component set for efficiency
    const stores = names.map(n => this.components.get(n));
    if (stores.some(s => !s)) return results;

    let smallest = 0;
    for (let i = 1; i < stores.length; i++) {
      if (stores[i].size < stores[smallest].size) smallest = i;
    }

    for (const [id] of stores[smallest]) {
      if (this.dead.includes(id)) continue;
      let hasAll = true;
      for (let i = 0; i < stores.length; i++) {
        if (i === smallest) continue;
        if (!stores[i].has(id)) { hasAll = false; break; }
      }
      if (hasAll) {
        const row = [id];
        for (const store of stores) row.push(store.get(id));
        results.push(row);
      }
    }
    return results;
  }

  kill(id) {
    if (!this.dead.includes(id)) {
      this.dead.push(id);
    }
  }

  flush() {
    for (const id of this.dead) {
      const names = this.entities.get(id);
      if (names) {
        for (const name of names) {
          const store = this.components.get(name);
          if (store) store.delete(id);
        }
      }
      this.entities.delete(id);
    }
    this.dead.length = 0;
  }

  // Count entities with a specific component
  count(name) {
    const store = this.components.get(name);
    return store ? store.size : 0;
  }
}
