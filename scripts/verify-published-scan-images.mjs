import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

export async function verifyPublishedScanImages(rows,{fetchImage=fetch,readImage=readFileSync}={}){
 const checked=new Set();
 for(const row of rows){
  for(const filename of [row.data.main_image,...row.data.option_images].filter(Boolean)){
   const asset=`quiz-images/${row.data.year}/${filename}`;
   if(checked.has(asset))continue;
   const response=await fetchImage(`https://periop-quiz.web.app/${asset}`,{redirect:'error',signal:AbortSignal.timeout(15000)});
   assert.ok(response.ok,`${row.id}: image is not published (${response.status})`);
   const published=Buffer.from(await response.arrayBuffer());
   assert.ok(published.equals(readImage(path.join('public',asset))),`${row.id}: published image differs`);
   checked.add(asset);
  }
 }
 return checked.size;
}
