const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const {create,act}=require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT=true;
async function setup(file){
 const destinations=[],logins=[];let change,error,unsubscribed=false;
 const router={replace:path=>destinations.push(path)};
 const mocks={'firebase/auth':{onAuthStateChanged:(_,cb,err)=>{change=cb;error=err;return()=>{unsubscribed=true;};}},'@/lib/firebase':{auth:{}},'next/navigation':{useRouter:()=>router},'@/lib/firebaseHelpers':{loginWithUsername:async(...args)=>{logins.push(args);change({uid:'fixture'});}}};
 const exports={};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(js,{exports,require:id=>mocks[id]||require(id),window:{location:{replace:path=>destinations.push(path)}},Audio:class{play(){return Promise.resolve();}},console});
 let renderer;await act(async()=>{renderer=create(React.createElement(exports.default));});
 return {renderer,destinations,logins,change:async u=>act(()=>change(u)),error:async()=>act(()=>error(Error('offline'))),close:async()=>{await act(()=>renderer.unmount());assert.equal(unsubscribed,true);}};
}
test('home waits for restored auth before sending the saved session to quiz',async()=>{const s=await setup('src/app/page.tsx');assert.equal(s.destinations.length,0);assert.equal(s.renderer.root.findAllByProps({role:'status'}).length,1);await s.change({uid:'saved'});assert.deepEqual(s.destinations,['/quiz']);await s.close();});
test('signed-out home and restoration failure lead to login without loops',async()=>{for(const fail of [false,true]){const s=await setup('src/app/page.tsx');if(fail)await s.error();else await s.change(null);assert.deepEqual(s.destinations,['/login']);await s.close();}});
test('login bookmark restores existing user without showing the login form',async()=>{const s=await setup('src/app/login/page.tsx');assert.equal(s.renderer.root.findAllByType('form').length,0);await s.change({uid:'saved'});assert.deepEqual(s.destinations,['/quiz']);assert.equal(s.renderer.root.findAllByType('form').length,0);assert.equal(s.logins.length,0);await s.close();});
test('signed-out login accepts credentials and auth observer navigates after success',async()=>{const s=await setup('src/app/login/page.tsx');await s.change(null);const inputs=s.renderer.root.findAllByType('input');assert.equal(inputs[0].props.autoComplete,'username');assert.equal(inputs[1].props.autoComplete,'current-password');await act(()=>{inputs[0].props.onChange({target:{value:'fixture'}});inputs[1].props.onChange({target:{value:'dummy-test-password'}});});await act(()=>s.renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.deepEqual(s.logins,[['fixture','dummy-test-password']]);assert.deepEqual(s.destinations,['/quiz']);await s.close();});
test('failed restoration leaves a usable login form with an explanation',async()=>{const s=await setup('src/app/login/page.tsx');await s.error();assert.equal(s.renderer.root.findAllByType('form').length,1);assert.equal(s.destinations.length,0);assert.match(JSON.stringify(s.renderer.toJSON()),/通信状態/);await s.close();});
