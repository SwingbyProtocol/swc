const ipfsClient = require('ipfs-http-client')
const Web3 = require('web3')
const config = require('config');

const nodes = config.get("eth")
const ipfsNodes = config.get("ipfs")

if (nodes.bootstamp.length == 0) {
    throw new Error("eth node is not set")
}

if (ipfsNodes.bootstamp.length == 0) {
    throw new Error("ipfs node is not set")
}

const eth = nodes.bootstamp[Math.floor(Math.random() * nodes.bootstamp.length)]
const ipfs = ipfsNodes.bootstamp[Math.floor(Math.random() * ipfsNodes.bootstamp.length)]

const web3 = new Web3(
    new Web3.providers.HttpProvider(`http://${eth.host}:${eth.port}`)
)

var ipfsInstance = ipfsClient({
    host: ipfs.host,
    port: ipfs.port,
    protocol: 'http'
})

module.exports = {
    web3: web3,
    ipfs: ipfsInstance
};