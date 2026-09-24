(function(root){'use strict';
 const units={scribe:['scribe','scribes'],copyist:['copyist','copyists'],editor:['editor','editors'],teacher:['teacher','teachers'],workshop:['workshop team','workshop teams'],scriptorium:['library section','library sections']};
 root.WTTNLanguage={units:(id,n)=>`${n} ${units[id][n===1?0:1]}`,hire:(id,n)=>`${id==='scriptorium'?'Add':id==='workshop'?'Organize':'Hire'} ${n===1?'a':n} ${units[id][n===1?0:1]}`,currency:{TI:'Translation Insight',NC:'Network Capacity',FE:'Field Experience'}};
if(typeof module==='object'&&module.exports)module.exports=root.WTTNLanguage;
})(globalThis);
