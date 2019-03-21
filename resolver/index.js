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
    if (ethNodes.bootstamp.length == 0 || instance.web3 != null) {
        console.log('web3 is alreay initialized or something wrong')
        return false
    }
    const eth = ethNodes.bootstamp[Math.floor(Math.random() * ethNodes.bootstamp.length)]
    const web3 = new web3js(
        new web3js.providers.HttpProvider(`http://${eth.host}:${eth.port}`)
    )
    instance.web3 = web3
    console.log(`web3 initialized ${eth.host} ${eth.port}`)

}

module.exports.initIPFS = () => {
    if (ipfsNodes.bootstamp.length == 0 || instance.ipfs != null) {
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
    return instance.web3
}