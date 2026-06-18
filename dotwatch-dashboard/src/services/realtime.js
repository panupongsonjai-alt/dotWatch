const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000'

let socket = null

export function connectRealtime(userId, onMessage) {
  if (!userId) return null

  socket = new WebSocket(WS_URL)

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        type: 'subscribe',
        userId,
      })
    )
  }

socket.onmessage = (event) => {
  try {
    const payload = JSON.parse(event.data)

    if (onMessage) {
      onMessage(payload)
    }
  } catch (error) {
    console.error(error)
  }
}

  socket.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  return socket
}

export function disconnectRealtime() {
  if (socket) {
    socket.close()
    socket = null
  }
}