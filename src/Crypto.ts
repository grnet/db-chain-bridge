export type Key = string[]
export interface CryptoInterface {
  generateKeys: () => {
    private: Key,
    public: Key
  }
  computeAward: (
    document: any, 
    issuerKey: Key
  ) => { s_awd: string, c: string, r: string }
  computeRequest: (
    s_awd: string, 
    c: string, 
    verifierPub: Key, 
    holderKey: Key
  ) => { s_req: string }
  computeProof: (
    s_req: string, 
    r: string, 
    c: string,
    s_awd: string,
    verifierPub: Key, 
    issuerKey: Key
  ) => { s_prf: string, proof: any }
  computeAck: (
    document: string, 
    s_prf: string, 
    proof: any,
    s_req: string,
    issuerPub: Key, 
    verifierKey: Key
  ) => { s_ack: string, status: 'success' | 'fail' }
}

