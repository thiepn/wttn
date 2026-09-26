// Local UI fixture only. Served explicitly by tools/preview-account.py --sdk.
// No Google requests, Supabase sessions, tokens or real user data are involved.
export function createThiepnAccount() {
  const G=globalThis.WTTNCore,F=globalThis.WTTNFullBackup,S=globalThis.WTTNSave;
  const s=G.createState();s.producers.scribe=9;s.pages=G.bn(1200);
  let row={revision:1,snapshot:F.make(S.makeEnvelope(s),{}),deleted:false},listener=()=>{};
  let user=localStorage.getItem('wttn.qa.account') ? {id:'00000000-0000-4000-8000-000000000011',email:'player@wttn-test.invalid'} : null;
  const account={
    async getSession(){return user?{user}:null;},
    onAuthStateChange(fn){listener=fn;return{unsubscribe(){}};},
    async signInWithGoogle(){user={id:'00000000-0000-4000-8000-000000000011',email:'player@wttn-test.invalid'};localStorage.setItem('wttn.qa.account','true');listener({event:'SIGNED_IN',session:{user}});},
    async signOut(){user=null;localStorage.removeItem('wttn.qa.account');listener({event:'SIGNED_OUT',session:null});},
    classifyError(){return 'network';},
    client:{async rpc(name,args){
      if(name==='wttn_save_history')return{data:[]};
      if(name==='wttn_write_save'){
        if(args.p_revision!==row.revision)return{data:{...row,status:'conflict'}};
        row={revision:row.revision+1,snapshot:args.p_snapshot,requestId:args.p_request_id,deleted:false};return{data:{...row,status:'saved'}};
      }
      if(name==='wttn_delete_save')row={revision:row.revision+1,snapshot:null,deleted:true};
      return{data:{...row}};
    }}
  };
  return account;
}
