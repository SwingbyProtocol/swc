'use strict';

const ihc = require('ipfs-http-client')
const web3js = require('web3')
const config = require('config');

const ethNodes = config.get("eth")
const ipfsNodes = config.get("ipfs")

let instance = {
    web3: null,
    ipfs: null
}

module.exports.initWeb3 = () => {
    if (ethNodes.bootstamp.length === 0 || instance.web3 !== null) {
        console.log('web3 is alreay initialized or something wrong')
        return false
    }
    const eth = ethNodes.bootstamp[Math.floor(Math.random() * Math.floor(ethNodes.bootstamp.length))]

    const wss = eth.port == "" ? `${eth.host}` : `${eth.host}:${eth.port}`

    const provider = new web3js.providers.WebsocketProvider(wss)

    provider.on('connect', () => console.log(`web3 websock initialized ${eth.host}`))

    provider.on('error', e => {
        console.error('WS Error')
        console.log(`web3 websock is not connect: error ${eth.host}`)
    })
    provider.on('close', e => {
        console.error('WS Closed: instance reset')
        instance.web3 = null
    })
    provider.on('end', e => {
        console.error('WS Ended: instance reset')
        instance.web3 = null
    })
    instance.web3 = new web3js(provider)
}

module.exports.initIPFS = () => {
    if (ipfsNodes.bootstamp.length === 0 || instance.ipfs !== null) {
        console.log('ipfs is alreay initialized or something wrong')
        return false
    }
    const ipfs = ipfsNodes.bootstamp[Math.floor(Math.random() * ipfsNodes.bootstamp.length)]
    var ipfsObj = ihc({
        host: ipfs.host,
        port: ipfs.port,
        protocol: 'http'
    })
    instance.ipfs = ipfsObj
    console.log(`ipfs initialized ${ipfs.host} ${ipfs.port}`)
}

module.exports.getIPFS = () => {
    return instance.ipfs
}

module.exports.getWeb3 = () => {
    if (instance.web3 === null) {
        this.initWeb3()
    }
    return instance.web3
}