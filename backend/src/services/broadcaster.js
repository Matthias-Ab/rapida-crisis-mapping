const { EventEmitter } = require('events')
const emitter = new EventEmitter()
emitter.setMaxListeners(500)

function broadcast(event, data) {
  emitter.emit('sse', { event, data })
}

function subscribe(callback) {
  emitter.on('sse', callback)
  return () => emitter.off('sse', callback)
}

module.exports = { broadcast, subscribe }
