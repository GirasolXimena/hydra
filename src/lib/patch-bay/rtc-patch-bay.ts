// Module for handling connections to multiple peers.


import io from 'socket.io-client'
import SimplePeer, { SignalData, SimplePeerData } from 'simple-peer'
import { EventEmitter as events } from 'events'
import shortid from 'shortid'

const extend = Object.assign

type PatchBayOptions = {
  server: string;
  id?: string;
  peerOptions: SimplePeer.Options;
  stream: MediaStream;
  // XG - todo: remove this any
  room: any;
}

type PatchBaySettings = 'shareMediaWhenRequested' | 'shareMediaWhenInitiating' | 'requestMediaWhenInitiating' | 'autoconnect'

class PatchBay extends events {
  signaller: SocketIOClient.Socket;
  id: string;
  settings: Record<PatchBaySettings, boolean>;
  rtcPeers: Record<string, SimplePeer.Instance & SimplePeer.Options>;
  peers: Record<string, SimplePeer.SimplePeer & {
    rtcPeer: string | null;
  }>;
  _peerOptions: SimplePeer.Options;
  stream: MediaStream;
  // XG - todo: remove this any
  _room: any;
  iceServers: RTCIceServer[]

  constructor(options: PatchBayOptions) {
    console.error('room', options.room)
    super()
    // connect to websocket signalling server. To DO: error validation
    this.signaller = io(options.server)

    //assign unique id to this peer, or use id passed in
    this.id = options.id || shortid.generate()

    this.stream = options.stream || null

    //options to be sent to simple peer
    this._peerOptions = options.peerOptions || {}
    this._room = options.room

    this.settings = {
     shareMediaWhenInitiating: true,
     shareMediaWhenRequested: false,
     requestMediaWhenInitiating: true,
     autoconnect: false 
    }

    this.iceServers = []

    //object containing ALL peers in room
    this.peers = {}

    //object containing peers connected via webrtc
    this.rtcPeers = {}

    // Handle events from signalling server
    this.signaller.on('ready', this._readyForSignalling.bind(this))
    //  this.signaller.on('peers', )
    //  this.signaller.on('signal', this._handleSignal.bind(this))
    this.signaller.on('message', this._handleMessage.bind(this))
    // Received message via websockets to all peers in room
    this.signaller.on('broadcast', this._receivedBroadcast.bind(this))

    // emit 'join' event to signalling server
    this.signaller.emit('join', this._room, { uuid: this.id })
    // console.log('emitting join')
    this.signaller.on('new peer', this._newPeer.bind(this))
  }
  // send data to all connected peers via data channels
  sendToAll(data: SimplePeer.SimplePeerData) {
    Object.keys(this.rtcPeers).forEach((id) => {
      this.rtcPeers[id].send(data)
    }, this)
  }
  // sends to peer specified b
  sendToPeer(peerId: string, data: SimplePeer.SimplePeerData) {
    if (peerId in this.rtcPeers) {
      this.rtcPeers[peerId].send(data)
    }
  }
  reinitAll() {
    Object.keys(this.rtcPeers).forEach((id: string) => {
      this.reinitRtcConnection(id)
    }, this)
    //  this._connectToPeers.bind(this)
  }
  initRtcPeer(id: string, opts: SimplePeer.Options) {
    this.emit('new peer', { id: id })
    var newOptions = opts
    // console.log()
    if (this.iceServers) {
      opts['config'] = {
        iceServers: this.iceServers
      }
    }

    if (opts.initiator === true) {
      if (this.stream != null) {
        if (this.settings.shareMediaWhenInitiating === true) {
          newOptions.stream = this.stream
        }
      }
      if (this.settings.requestMediaWhenInitiating === true) {
        newOptions.offerOptions = {
          offerToReceiveVideo: true,
          offerToReceiveAudio: true
        }
      }
    } else {
      if (this.settings.shareMediaWhenRequested === true) {
        if (this.stream != null) {
          newOptions.stream = this.stream
        }
      }
    }
    var options = extend(this._peerOptions, newOptions)
    //console.log("OPTIONS", options)
    this.rtcPeers[id] = new SimplePeer(options)
    this._attachPeerEvents(this.rtcPeers[id], id)
  }
  reinitRtcConnection(id: string, opts: SimplePeer.Options = {}) {
    // Because renegotiation is not implemeneted in SimplePeer, reinitiate connection when configuration has changed
    this.rtcPeers[id]._destroy(null, (e) => {
      this.initRtcPeer(id, {
        stream: opts.stream || this.stream,
        initiator: opts.initiator || true,
      })
    })
  }

  
  // //new peer connected to signalling server
  _newPeer(peer: string) {
    // this.connectedIds.push(peer)
    // Configuration for specified peer.
    // Individual configuration controls whether will receive media from
    // and/or send media to a specific peer.
    this.peers[peer].rtcPeer = null

    this.emit('new peer', peer)
    // this.emit('updated peer list', this.connectedIds)
  }
  // // Once the new peer receives a list of connected peers from the server,
  // // creates new simple peer object for each connected peer.
  _readyForSignalling({ peers, servers }: {
    peers: string[];
    servers: RTCIceServer[]
  }) {
    //console.log("received peer list", _t, this.peers)
    peers.forEach((peer: string) => {
      this._newPeer(peer)
    })

    // if received ice and turn server information from signalling server, use in establishing
    if (servers) {
      this.iceServers = servers
    }
    //  this.peers = peers
    this.emit('ready')
  }
  // Init connection to RECEIVE video
  initConnectionFromId(id: string, callback: () => void) {
    //  console.log("initianing connection")
    if (id in this.rtcPeers) {
      console.log("Already connected to..", id, this.rtcPeers)
      //if this peer was originally only sending a stream (not receiving), recreate connecting but this time two-way
      if (this.rtcPeers[id].initiator === false) {
        this.reinitRtcConnection(id)
      } else {
        //already connected, do nothing
      }
    } else {
      this.initRtcPeer(id, {
        initiator: true
      })
    }
  }
  // receive signal from signalling server, forward to simple-peer
  _handleMessage(data: {
    id: string;
    type: string;
    message: SignalData;
  }) {
    // if there is currently no peer object for a peer id, that peer is initiating a new connection.
    if (data.type === 'signal') {
      this._handleSignal(data)
    } else {
      this.emit('message', data)
    }
  }
  // receive signal from signalling server, forward to simple-peer
  _handleSignal(data: {
    id: string;
    message: SignalData
  }) {
    // if there is currently no peer object for a peer id, that peer is initiating a new connection.
    if (!this.rtcPeers[data.id]) {
      // this.emit('new peer', data)
      // var options = extend({stream: this.stream}, this._peerOptions)
      // this.rtcPeers[data.id] = new SimplePeer(options)
      // this._attachPeerEvents(this.rtcPeers[data.id], data.id)
      this.initRtcPeer(data.id, { initiator: false })
    }
    this.rtcPeers[data.id].signal(data.message)
  }
  // sendToAll send through rtc connections, whereas broadcast
  // send through the signalling server. Useful in cases where
  // not all peers are connected via webrtc with other peers
  _receivedBroadcast(data: SignalData) {
    //console.log("RECEIVED BROADCAST", data)
    this.emit('broadcast', data)
  }
  //sends via signalling server
  broadcast(data: SignalData) {
    this.signaller.emit('broadcast', data)
  }
  // handle events for each connected peer
  _attachPeerEvents(p: SimplePeer.Instance, id: string) {
    p.on('signal', (id: string, signal: SignalData) => {
      //  console.log('signal', id, signal)
      //  console.log("peer signal sending over sockets", id, signal)
      //  this.signaller.emit('signal', {id: id, signal: signal})
      this.signaller.emit('message', { id: id, message: signal, type: 'signal' })
    })

    p.on('stream', (id: string, stream: MediaStream) => {
      this.rtcPeers[id].addStream(stream)
      //  console.log('E: stream', id, stream)
      //  console.log("received a stream", stream)
      this.emit('stream', id, stream)
    })

    p.on('connect', (id: string) => {
      //  console.log("connected to ", id)
      this.emit('connect', id)
    })

    p.on('data', (id: string, data: SimplePeerData) => {
      //    console.log('data', id)
      data = String(data)
      this.emit('data', { id: id, data: JSON.parse(data) })
    })

    p.on('close', (id: string) => {
      //console.log('CLOSED')
      delete (this.rtcPeers[id])
      this.emit('close', id)
    })

    p.on('error', (e) => {
      console.warn("simple peer error", e)
    })
  }
  _destroy() {
    Object.values(this.rtcPeers).forEach(function (peer) {
      peer.destroy()
    })
    this.signaller.close()
  }
}

export default PatchBay
