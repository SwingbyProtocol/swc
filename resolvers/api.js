'use strict';

const ipfsClient = require('ipfs-http-client')
const web3js = require('web3')
const config = require('config');

const ethConf = config.get("eth")
const ipfsConf = config.get("ipfs")

let instance = {
    web3: null,
    ipfs: null
}

module.exports.initWeb3 = () => {
    if (ethConf.nodes.length === 0 || instance.web3 !== null) {
        console.log('web3 is alreay initialized or something wrong')
        return false
    }
    const eth = ethConf.nodes[Math.floor(Math.random() * Math.floor(ethConf.nodes.length))]

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
    if (ipfsConf.nodes.length === 0 || instance.ipfs !== null) {
        console.log('ipfs is alreay initialized or something wrong')
        return false
    }
    const ipfs = ipfsConf.nodes[Math.floor(Math.random() * ipfsConf.nodes.length)]
    var ipfsObj = ipfsClient(ipfs.uri, undefined, {
        timeout: 4
    })
    instance.ipfs = ipfsObj
    console.log(`ipfs initialized ${ipfs.uri}`)
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