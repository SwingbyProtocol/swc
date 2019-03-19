# SWC
implementation of Swingby Witness Component(SWC)

To do
- [ ] metaTx relayer
- [ ] ipfs resolver

Using

- fastify 
- fastify-swagger

## APIs

#### Using MetaTx Relayer

API endpoint 
- [POST] /api/v1/relayer
```body
{
    // all of params should be hexstring removed "0x"
    params: {
        from, 
        to,  
        amount,  
        inputs[4], // 0 => _gasPrice, 1 => _gasLimit, 2 => _gasTokenPerWei, 3 => nonce
        relayer,
        tokenReceiver
    },
    sig: "signaterue of sender"
}
```
return `JSON`
```
{
    result: true, 
    txHash: "transaction hash"
}
```