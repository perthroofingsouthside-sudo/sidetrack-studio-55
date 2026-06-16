# WebSocket Test Suite — Jam Room WebRTC Signaling

Use `python-socketio` client to connect and test Socket.IO signaling for the Jam Room WebRTC feature.

## 1. Connection Lifecycle Testing
- Test successful connection to `/api/socket.io`
- Test connection failure with wrong path (should fail)
- Test disconnect event fires correctly
- Test connection status tracking
- Verify resource cleanup on disconnect

## 2. Room Management Testing
- Test `join_room` event with valid `room_id` (jam room code)
- Test `join_room` with missing/invalid `room_id` (handled gracefully)
- Test multiple clients in same room receive `peer-joined` events
- Test clients in different rooms (signaling messages isolated)
- Test leaving room on disconnect → other peers receive `peer-left` event

## 3. Broadcasting & Real-time Sync Testing (WebRTC signaling)
- Test `webrtc-offer` event delivered only to the target peer in the room
- Test `webrtc-answer` event delivered only to the offering peer
- Test `webrtc-ice` candidates exchanged between two specific peers
- Test `peer-joined` broadcast on join (existing peers see new arrival)
- Test `peer-left` broadcast on disconnect

## 4. Error Handling Testing
- Test malformed `room_id` handling
- Test missing target peer in signaling events
- Test rapid connect/disconnect cycles
- Test `socket.connected` check before emit
- Test reconnection logic with exponential backoff

## 5. Multi-user Collaboration Testing
- Test 2+ users in same room receive each other's WebRTC signals
- Test up to 4-peer mesh: every pair exchanges offer/answer/ICE
- Test user addition/removal from room
- Test access control via `jam_invites` token if implemented

## 6. Performance Testing
- Test multiple concurrent jam rooms
- Test rapid successive ICE candidate exchanges (no message loss)

## Playwright Frontend Testing

### 1. Connection & UI State
- Test "Connected to Jam Room" indicator appears
- Test mic/camera buttons enable when connection establishes
- Test reconnection UI feedback on network interruption

### 2. Real-time Updates
- Test second browser tab joining the same room shows the first peer's video stream
- Test mute/camera-off state syncs across peers

### 3. Multi-user Collaboration (up to 4 peers)
- Test 2 browsers in same jam-room see each other's video
- Test 3rd browser joining triggers offers from both existing peers
- Test peer leaving removes their tile

### 4. Error Handling & Edge Cases
- Test UI behavior when socket disconnects mid-call
- Test queued ICE candidates after reconnection
- Test component unmount properly disconnects socket + closes RTCPeerConnection (no memory leaks)

### 5. Room Management
- Test joining via `roomCode` URL param / invite link
- Test leaving room on navigate-away
