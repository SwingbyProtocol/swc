'use strict';

const ethTx = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util')
const bs58 = require('bs58')
const BN = ethUtil.BN
const config = require('config')
const btc2eth1 = require('../build/contracts/Btc2eth1.json')
const api = require("../resolvers").api
const account = require('../resolvers').account()
const ecies = require("eth-ecies");
const sha256 = require('sha256')

let btc2eth1Instance = {}
let txs = {}
let lastIPFSHash
let data = {}

api.initWeb3()
api.initIPFS()
console.log('daemon start')

setTimeout(async () => {
    try {
        const web3 = api.getWeb3()
        const ipfs = api.getIPFS()
        btc2eth1Instance = new web3.eth.Contract(btc2eth1.abi, config.eth.btc2eth1.address)
        eventHandler(ipfs, btc2eth1Instance)

        setTimeout(async () => {
            await fetchKeep(web3, ipfs)
            await checkWshes(web3, ipfs)
            await updateKeep(web3, ipfs)
        }, 10000)

    } catch (err) {
        console.log(err)

    }

}, 5000)

const injectData = () => {
    data.relayer = {
        address: account.address,
        pubkey: '0x' + ethUtil.privateToPublic(account.privkey).toString('hex')
    }
    data.witnesses = {}
    data.wshSecrets = {}
}
const fetchKeep = async (web3, ipfs) => {
    const getStoredData = await btc2eth1Instance.methods.getKeep(account.address).call()
    if (emptyAddress(getStoredData.toString())) {
        console.log('error data is not stored')
        injectData()
    } else {
        try {
            const ipfsHash = toIPFSHash(getStoredData.toString())
            const result = await ipfsCall(ipfs, ipfsHash)
            if (!result.relayer) {
                console.log('error data is not exist will be init')
                injectData()

            } else {
                data = result
            }
            //injectData()
        } catch (err) {
            console.log(err)
        }
    }
}

const checkWshes = async (web3, ipfs) => {
    const inject = data.wshSecrets
    const keys = Object.keys(inject)
    if (keys.length <= 10) {
        const secret = web3.utils.randomHex(32)
        const wsh = '0x' + sha256(Buffer.from(secret.slice(2), 'hex'))
        console.log(secret, wsh)
        addWshHashGroup(wsh, secret, data.witnesses)
        const func = btc2eth1Instance.methods.addWsh(wsh)
        setTimeout(() => {
            sendTx('addWsh', web3, func.encodeABI())
        }, 70000)
    } else {
        console.log('reach max size of secrets')
    }

    setTimeout(() => {
        checkWshes(web3, ipfs)
    }, 124400)
}

const updateKeep = async (web3, ipfs) => {
    const ipfsHash = await store(ipfs)
    const func = btc2eth1Instance.methods.keep(ipfsHash)
    sendTx('keep', web3, func.encodeABI())
    setTimeout(() => {
        updateKeep(web3, ipfs)
    }, 121000)
}

const store = async (ipfs) => {
    let bytes32
    let cid
    try {
        const doc = JSON.stringify(data, null, 4)
        console.log(data)
        cid = await ipfs.add(Buffer.from(doc));
        bytes32 = fromIPFSHash(cid[0].hash)
        console.log("IPFS cid:", cid[0].hash);
        await ipfs.pin.add(cid[0].hash)
        console.log('pin', cid[0].hash)
        if (lastIPFSHash) {
            await ipfs.pin.rm(lastIPFSHash)
            console.log('pin rm', lastIPFSHash)
        }
    } catch (err) {
        console.log(err)
    }
    lastIPFSHash = cid[0].hash
    return '0x' + bytes32.toString('hex')
}

const attachWitnessToData = async (ipfs, own, ipf) => {
    try {
        const ipfsPath = toIPFSHash(ipf)
        const parsed = await ipfsCall(ipfs, ipfsPath)
        if (!data.relayer) {
            console.log('error data is not exist')
            return false
        }
        if (data.witnesses[own]) {
            console.log('already attached')
            return false
        }
        data.witnesses[own] = parsed.relayer
        console.log('Add witness to keep...', own)
    } catch (err) {
        console.log(err)
    }
}

const sendTx = async (method, web3, data) => {
    const batch = []
    batch.push(web3.eth.getTransactionCount(account.address))

    const calls = await Promise.all(batch)

    const txParams = {
        nonce: '0x' + calls[0].toString(16),
        gasPrice: 2000000000,
        gasLimit: 300000,
        from: account.address,
        to: btc2eth1Instance.address,
        data: data,
        chainId: process.env.NODE_ENV === 'mainnet' ? 0 : 5
    };

    const tx = new ethTx(txParams);
    tx.sign(account.privkey);

    const serializedTx = '0x' + tx.serialize().toString('hex')

    if (txs[serializedTx]) {
        console.log("tx is already sent")
        return false
    }

    const txHash = await handleSend(web3, serializedTx)
    console.log('sending tx...', method, txHash)
}



function eventHandler(ipfs, btc2eth1Instance) {
    btc2eth1Instance.events.KeepEvent()
        .on('data', (event) => {
            //console.log(event); // same results as the optional callback above
            updateDataByKeepEvent(ipfs, event)
        })
        .on('changed', (event) => {
            console.log(event.returnValues.ipf, 'change'); /// remove event from local database
        })
        .on('error', (err) => {
            console.log(err)
        })
}

const updateDataByKeepEvent = (ipfs, event) => {
    attachWitnessToData(ipfs, event.returnValues.own, event.returnValues.ipf)
}


const handleSend = (web3, serializedTx) => {
    return new Promise((resolve, reject) => {
        web3.eth.sendSignedTransaction(serializedTx)
            .on('transactionHash', (txHash) => {
                resolve(txHash)
            })
            .on('error', function (err) {
                reject(err)
            })
            .on('confirmation', function (confirmationNumber, receipt) {
                if (confirmationNumber <= 5)
                    console.log(confirmationNumber, receipt.transactionHash)
            })
    })
}

function addWshHashGroup(wsh, wshSecret, witnesses) {
    const keys = Object.keys(witnesses)
    if (keys.length >= 3) {
        data.wshSecrets[wsh] = []
        keys.forEach((address) => {
            const witness = witnesses[address]
            let userPublicKey = Buffer.from(witness.pubkey.slice(2), 'hex');
            let bufferData = Buffer.from(wshSecret);
            let encryptedData = ecies.encrypt(userPublicKey, bufferData);
            data.wshSecrets[wsh].push({
                address: witness.address,
                encrypted: encryptedData.toString('base64')
            })
        })
    }
    console.log(data)
}

function decryptWshHash(wsh, data) {
    let userPrivateKey = account.privkey
    let bufferEncryptedData = new Buffer(encryptedData, 'base64');
    let decryptedData = ecies.decrypt(userPrivateKey, bufferEncryptedData);
}



const ipfsCall = (ipfs, ipfsHash) => {
    return new Promise((resolve, reject) => {
        ipfs.cat(ipfsHash).then((retunData) => {
            const result = JSON.parse(retunData.toString())
            resolve(result)
        }).catch((err) => {
            reject(err)
        })
    })
}


const fromIPFSHash = hash => {
    const bytes = bs58.decode(hash);
    const multiHashId = 2;
    // remove the multihash hash id
    return bytes.slice(multiHashId, bytes.length);
};
const toIPFSHash = str => {
    // remove leading 0x
    const remove0x = str.slice(2, str.length);
    // add back the multihash id
    const bytes = Buffer.from(`1220${remove0x}`, "hex");
    const hash = bs58.encode(bytes);
    return hash;
};

const emptyAddress = address => {
    return /^0x0+$/.test(address)
}