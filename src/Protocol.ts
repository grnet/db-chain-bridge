import { CryptoInterface, Key } from "./Crypto";
import {  LedgerInterface } from "./Ledger";
import { MessagingInterface } from "./Messaging";
import { StorageEntry, StorageInterface } from "./Storage";


export interface UserInterface {
  _id: string;
  pubKey: string,
  email: string,
  keys: {
    crypto: {
      private: string[]
    }
  }
}

export interface ProtocolInterfaceConstructor {
  storage: StorageInterface;
  ledger: LedgerInterface;
  messaging: MessagingInterface;
  crypto: CryptoInterface;
  user: UserInterface
}

export interface ProtocolInterface  {
  award: (documentId: string, callback?: any) => Promise<StorageEntry>;
  request: (awardDocumentId: string, verifierPub: Key, callback?:any) => Promise<StorageEntry>;
  proof: (requestId: string, verifierPub: Key) => Promise<StorageEntry>;
  acknowledge: (proofRequestId: string, document: any) => Promise<StorageEntry>;
}

export class Protocol implements ProtocolInterface {
  storage: StorageInterface;
  ledger: LedgerInterface;
  messaging: MessagingInterface;
  crypto: CryptoInterface;
  user: UserInterface;

  constructor(props: ProtocolInterfaceConstructor){
    this.storage = props.storage
    this.ledger = props.ledger
    this.messaging = props.messaging
    this.crypto = props.crypto
    this.user = props.user
  }

  async award(issuedDocumentID) {
    const issuerKey = this.user.keys.crypto.private
    const issuedDocument = await this.storage.getBy('IssuedDocument', {_id: issuedDocumentID}) as any
    const documentID = issuedDocument.document
    console.log('getting document', documentID)
    const document = await this.storage.getBy('Document', {_id: documentID}) as any
    // const holder = await this.messaging.getEntity(holderPub)
    // console.log(document)
    if(!document){
      throw new Error('No Document found')
    }
    console.log('computing award')
    const { s_awd, c, r } = await this.crypto.computeAward(JSON.stringify(document), issuerKey)
    issuedDocument.c = c
    issuedDocument.r = r
    issuedDocument.s_awd = s_awd
    issuedDocument.status = 'pending'
    console.log('updating issued document', issuedDocument)
    await this.storage.update('IssuedDocument', issuedDocument._id, issuedDocument)
    console.log('publishing award')
    const {hash} =  await this.ledger.publish(s_awd)
    const {status} = await this.ledger.getTransactionSync(hash)
    issuedDocument.status = status;
    await this.storage.update('IssuedDocument', issuedDocument._id, issuedDocument)
    if(status === 'confirmed'){
      console.log('published award')
      await this.messaging.sendMessage(document.document.holderEmail, 'award', {
        ...document, t_awd: hash, c,
        issuerEmail: this.user.email
      })
    }
    return issuedDocument
  }

  async request(requestId) {
    const shareRequest = await this.storage.getBy('ShareRequest', {_id: requestId}) as any
    console.log('got share request', shareRequest)
    const awardedDocument = await this.storage.getBy('AwardedDocument', {_id: shareRequest.document}) as any
    const {t_awd, c} = awardedDocument;
    const {data: s_awd} = await this.ledger.getTransactionSync(t_awd)
    console.log('got awarded document', s_awd, awardedDocument)
    const issuer = await this.messaging.getEntity(shareRequest.issuerEmail)
    console.log('got issuer', issuer)
    const verifier = await this.messaging.getEntity(shareRequest.verifierEmail) 
    console.log('got verifier', verifier)
    console.log('create request')
    console.log('compute request')
    const {s_req} = await this.crypto.computeRequest(s_awd, c, verifier.publicKey, this.user.keys.crypto.private)
    console.log('publish request', s_req)
    const {hash} = await this.ledger.publish(s_req)
    shareRequest.status = 'pending'
    shareRequest.s_req = s_req
    shareRequest.t_req = hash
   
    console.log('wait request publication', hash)
    const {status} = await this.ledger.getTransactionSync(hash)
    console.log('request publication', status)
    shareRequest.status = status;
    console.log('update request', status)
    this.storage.update('ShareRequest', shareRequest.id, shareRequest)
    if(status === 'confirmed'){
      console.log('send to issuer', status)
      await this.messaging.sendMessage(shareRequest.issuerEmail, 'request', {
        t_req: hash, 
        s_awd,
        holderEmail: this.user.email,
        verifierEmail: shareRequest.verifierEmail,
        issuerEmail: shareRequest.issuerEmail
      })
    }
    return shareRequest
  }

  async proof(requestId) {
    let request = await this.storage.getBy('ProofShareRequest', {_id: requestId}) as any
    console.log('Got proof request', request)
    const {s_awd, c, r} = await this.storage.getBy('IssuedDocument', {_id: request.document}) as any
    console.log('Got issued document', s_awd)
    const verifier = await this.messaging.getEntity(request.verifierEmail)
    console.log('Got verifier', verifier)
    const t = await this.ledger.getTransactionSync(request.t_req)
    console.log('Got transaction', t)
    const s_req = t.data
    console.log(verifier)
    const issuerKey = this.user.keys.crypto.private

    const {s_prf, proof} = await this.crypto.computeProof(
      s_req, 
      r, 
      c,
      s_awd, 
      verifier.publicKey, 
      issuerKey
    )
    request.status = 'pending'
    await this.storage.update('ProofShareRequest', request._id, request)
    const {hash} = await this.ledger.publish(s_prf)
    const {status} = await this.ledger.getTransactionSync(hash)
    if(status === 'confirmed'){
      await this.messaging.sendMessage(request.verifierEmail, 'proof', {proof, hash})
    }
    request.status = 'confirmed';
    request.signatureTransaction = hash
    await this.storage.update('ProofShareRequest', request._id, request)
    return request
  }

  acknowledge(proofRequestId, document) {
    console.log(proofRequestId, document)
    return {} as any
  }
}


export default Protocol


export class Authority extends Protocol {

  createProfile(){

  }
  retrieveProfile(){}
  disableProfile(){

  }
}