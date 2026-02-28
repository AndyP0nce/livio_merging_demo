/**
 * apartment_event_bus.js
 * Lightweight pub/sub event bus that decouples Livio apartment modules.
 * Must be loaded before all other apartment_*.js scripts.
 *
 * Usage:
 *   const bus = new EventBus();
 *   const unsub = bus.subscribe('filter:changed', (data) => doSomething(data));
 *   bus.publish('filter:changed', { query: 'Northridge' });
 *   unsub(); // remove the listener
 *
 * Events published by each module:
 *
 *   MapManager
 *     'map:boundsChanged'        (no data)
 *     'map:markerHovered'        { listingId, isHovering }
 *     'map:markerClicked'        { listingId }
 *     'map:uniDblClicked'        { university }
 *
 *   FilterManager
 *     'filter:changed'           (no data)
 *     'filter:targetChanged'     { university }
 *     'filter:searchChanged'     { matches }
 *     'filter:placeSelected'     { placeId }
 *
 *   CardRenderer
 *     'card:hovered'             { listingId, isHovering }
 *     'card:clicked'             { listingId }
 */
class EventBus {
  constructor() {
    /** @type {Object.<string, Function[]>} */
    this._listeners = Object.create(null);
  }

  /**
   * Subscribe to an event.
   * @param {string}   event
   * @param {Function} callback
   * @returns {Function} call to unsubscribe
   */
  subscribe(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Remove a specific listener.
   * @param {string}   event
   * @param {Function} callback
   */
  unsubscribe(event, callback) {
    const list = this._listeners[event];
    if (!list) return;
    this._listeners[event] = list.filter((cb) => cb !== callback);
  }

  /**
   * Publish an event to all subscribers.
   * A shallow copy of the listener array is iterated so that
   * subscriptions added inside a callback are not invoked in
   * the same cycle.
   * @param {string} event
   * @param {*}      [data]
   */
  publish(event, data) {
    (this._listeners[event] || []).slice().forEach((cb) => cb(data));
  }
}

window.EventBus = EventBus;
