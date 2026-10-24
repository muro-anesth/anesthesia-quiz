// Loopback-only synthetic UI test. Never deploy this server or its generated files.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '..');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'periop-study-preview-'));
const data = `export const questions = [1,2,3].map(n=>({id:'sample-'+n,qnum:n,year:'2025a',category:'気道管理',stem:'【動作確認用の架空問題】回答後の操作を確認します。次の選択肢からAを選んでください。\\n★は回答の前後どちらでも付けられます。',choices:{a:'正しい選択肢です。',b:'動作確認用の誤りの選択肢です。',c:'長い選択肢もスマートフォンの幅で折り返し、横スクロールを発生させません。'},answer:'a',is_image_question:false,main_image:null,subitems:null,explanation:'【合成データの解説】これは画面と操作を確認するための架空問題で、実際の問題・回答・利用者データは使っていません。\\n\\n正誤による復習間隔の自動調整と、★の付け外し・一覧を確認できます。'}));`;
const mocks = {
  'fixture-data': data,
  '@/lib/firebase': `export const auth={currentUser:{uid:'preview-only'}}; export const db={};`,
  'firebase/auth': `import {auth} from '@/lib/firebase'; export function onAuthStateChanged(_,cb){cb(auth.currentUser);return()=>{};}`,
  'firebase/firestore': `import{questions}from'fixture-data';export function doc(...args){return args.at(-1)}export async function getDoc(id){const q=questions.find(q=>q.id===id);return{id,exists:()=>!!q,data:()=>q}}`,
  '@/lib/questionStars': `const stars=new Set(['sample-2']);export async function getQuestionStars(){return [...stars]}export async function setQuestionStar(_,id,starred){await new Promise(r=>setTimeout(r,150));if(starred)stars.add(id);else stars.delete(id)}`,
  '@/lib/dailyQuizData': `import{questions}from'fixture-data';export async function loadDailyQuizData(){return{questions,progress:[],attempts:[]}}export async function getDailyQuizQuestion(id){return questions.find(q=>q.id===id)}`,
  '@/lib/firebaseHelpers': `import{questions}from'fixture-data';export async function getUserProfile(){return{username:'画面確認用（合成データ）',role:'user'}}export async function getYears(){return['2025a']}export async function getCategories(){return['気道管理']}let index=0;export async function getNextQuestion(){return{question:questions[index++%3],cycleComplete:false}}export async function saveAttempt(_,id,selected,answer){return{isCorrect:selected===answer}}export async function fetchQuestions(){return questions}export async function getReviewQueue(){return{total:3,cards:questions.map(q=>({questionId:q.id,year:q.year,qnum:q.qnum,stem:q.stem,category:q.category}))}}export async function getStats(){return{total:0,categories:[]}}export async function getQuestionsForYear(year){return questions.map(q=>({...q,year}))}export async function saveExamResult(){}export async function getExamHistory(){return[]}export async function logout(){}export async function getUsers(){return[]}export async function adminCreateUser(){}export async function adminChangePassword(){}`,
};
(async () => {
  await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import QuizApp from './src/features/quiz/QuizApp';createRoot(document.getElementById('app')).render(<QuizApp/>);`, resolveDir: root, loader: 'tsx' }, outfile: path.join(folder, 'app.js'), bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'synthetic-only', setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (Object.hasOwn(mocks, args.path)) return { path: args.path, namespace: 'mock' };
      if (args.path === './sound') return { path: 'silent', namespace: 'mock' };
      if (args.path.startsWith('@/')) return { path: path.join(root, 'src', args.path.slice(2)) + (path.extname(args.path) ? '' : '.ts') };
    });
    b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'silent' ? 'export function playSound(){}export function setSfxEnabled(){}' : mocks[args.path], loader: 'js' }));
  } }] });
  const server = http.createServer((req, res) => {
    if (req.url === '/app.js') {res.setHeader('Content-Type', 'text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(folder, 'app.js')));return;}
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>周術期クイズ — 合成データ検証</title><style>html,body{margin:0;background:#0d1526}button{font-family:inherit}*{box-sizing:border-box}</style><div id="app"></div><script src="/app.js"></script></html>');
  }).listen(8901, '127.0.0.1', () => console.log('Synthetic preview: http://127.0.0.1:8901 (no Firebase / no real user data)'));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => {fs.rmSync(folder, {recursive:true,force:true});process.exit(0);}));
})().catch(error => {fs.rmSync(folder, {recursive:true,force:true});console.error(error.message);process.exitCode = 1;});
