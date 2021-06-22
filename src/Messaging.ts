

export interface MessagingInterface {
  sendMessage: (pubKey: string, transaction: string, data: unknown) => Promise<{
    status: 'success' | 'fail';
  }>

  getEntity: (pubKey:string) => Promise<{
    title: string;
    publicKey: any;
    walletAddress: string;
    service: string;
    type: 'Holder'| 'Issuer'| 'Verifier';
    contract: string;
  }>
}
