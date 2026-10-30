const TOP=['schema_version','gerado_em','achado_novo','ranking','produtos','categorias'];
const PRODUCT=['id','numero','nome','medida','medida_conferida','preco','links','publicavel','foto','prova_social','categoria'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function only(o,keys,label){if(!object(o)||Object.keys(o).some(k=>!keys.includes(k)))throw Error(`${label}: campos fora do contrato público`);}
function text(v,max=250){return typeof v==='string'&&v.trim().length>0&&v.length<=max;}
function validatePhoto(photo,number){only(photo,['src','alt'],'Foto');if(typeof photo.src!=='string'||!/^fotos\/\d{2,6}\.webp$/.test(photo.src)||photo.src!==`fotos/${number}.webp`||!text(photo.alt,160))throw Error('Foto com caminho ou descrição inválidos');}
export function photoURL(product,jsonURL){if(!Object.hasOwn(product,'foto'))return null;validatePhoto(product.foto,product.numero);return new URL(product.foto.src,jsonURL).href;}
export function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const t=Date.parse(v+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v;}
export function socialProofText(product,{today=new Date().toISOString().slice(0,10)}={}){
 if(!Object.hasOwn(product,'prova_social'))return null;
 const proof=product.prova_social;only(proof,['nota','avaliacoes','vendidos','consultado_em'],'Prova social');
 const count=value=>text(value,20)&&/^\d+(?:,\d+)?(?: mil)?\+?$/.test(value);
 if(typeof proof.nota!=='number'||!Number.isFinite(proof.nota)||proof.nota<0||proof.nota>5||Math.abs(proof.nota*10-Math.round(proof.nota*10))>1e-8||!count(proof.avaliacoes)||!count(proof.vendidos)||!validDate(proof.consultado_em)||proof.consultado_em>today)throw Error('Prova social com nota, contagem ou data inválida');
 if((Date.parse(today)-Date.parse(proof.consultado_em))/86400000>45)return null;
 const [,month,day]=proof.consultado_em.split('-');
 return `★ ${proof.nota.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} · ${proof.avaliacoes} avaliações · ${proof.vendidos} vendidos (dados do anúncio em ${day}/${month})`;
}
export function purchaseLink(value){if(typeof value!=='string')return null;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['s.shopee.com.br','shopee.com.br','www.shopee.com.br'].includes(u.hostname)&&!/[\s\u0000-\u001f]/.test(value)?u.href:null;}catch{return null;}}
export function originFrom(search){const value=new URLSearchParams(search).get('de');return value==='ig'||value==='tt'?value:'';}
export function colorForNumber(number){const n=Number(number);return Number.isSafeInteger(n)&&n>0?['coral','petroleo','sol','menta','chiclete'][(n-1)%5]:'petroleo';}
export function findByHash(catalog,hash){let number;try{number=decodeURIComponent(hash.replace(/^#/,''));}catch{return null;}if(!/^\d+$/.test(number))return null;return catalog.items.find(p=>Number(p.numero)===Number(number))||null;}
export function findProducts(catalog,query=''){
 const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const q=normalize(query).trim();const number=q.match(/^(?:(?:achado\s*)?(?:n[ºo°.]?\s*)?#?\s*)?(\d+)$/)?.[1];
 return catalog.items.filter(p=>!q||(number!==undefined?Number(p.numero)===Number(number):normalize(`${p.numero} ${p.nome}`).includes(q)))
  .sort((a,b)=>b.numero.localeCompare(a.numero,'pt-BR',{numeric:true})||a.nome.localeCompare(b.nome,'pt-BR'));
}
export function validateCatalog(data,{today=new Date().toISOString().slice(0,10)}={}){
 only(data,TOP,'Catálogo');if(data.schema_version!==1||!text(data.gerado_em)||!Number.isFinite(Date.parse(data.gerado_em))||!Array.isArray(data.produtos)||!Array.isArray(data.ranking)||(data.achado_novo!==null&&!text(data.achado_novo,100)))throw Error('Catálogo fora do contrato v1');
 const categories=data.categorias===undefined?[]:data.categorias;if(!Array.isArray(categories))throw Error('Categorias inválidas');const categoryIds=new Set();for(const c of categories){only(c,['id','nome'],'Categoria');if(!/^[a-z]{3,20}$/.test(c.id)||!text(c.nome,30)||categoryIds.has(c.id))throw Error('Categoria inválida ou repetida');categoryIds.add(c.id);}const numbers=new Set();
 const seen=new Set(),items=[];
 for(const p of data.produtos){only(p,PRODUCT,'Produto');if(!text(p.id,100)||seen.has(p.id)||!text(p.numero,20)||!text(p.nome,180)||!text(p.medida,180)||typeof p.publicavel!=='boolean'||typeof p.medida_conferida!=='boolean')throw Error('Produto com campos inválidos ou ID repetido');if(!/^\d{1,6}$/.test(p.numero)||Number(p.numero)<1||numbers.has(Number(p.numero)))throw Error('Número inválido ou repetido');numbers.add(Number(p.numero));if(Object.hasOwn(p,'categoria')&&!categoryIds.has(p.categoria))throw Error('Categoria ausente');seen.add(p.id);only(p.links,['ig','tt'],'Links');for(const link of Object.values(p.links))if(!purchaseLink(link))throw Error('Link de compra não autorizado');
  let item=p;if(Object.hasOwn(p,'prova_social')&&socialProofText(p,{today})===null){item={...p};delete item.prova_social;}
  if(Object.hasOwn(p,'foto'))validatePhoto(p.foto,p.numero);
  if(p.preco!==null){only(p.preco,['valor','consultado_em'],'Preço');if(typeof p.preco.valor!=='number'||!Number.isFinite(p.preco.valor)||p.preco.valor<=0||!validDate(p.preco.consultado_em)||p.preco.consultado_em>today)throw Error('Preço ou data de consulta inválidos');}
  if(p.publicavel===true&&p.medida_conferida===true)items.push(item);
 }
 if(data.ranking.some(id=>!text(id,100)||!seen.has(id))||new Set(data.ranking).size!==data.ranking.length||(data.achado_novo!==null&&!seen.has(data.achado_novo)))throw Error('Seleção referencia produto ausente ou repetido');
 const byId=new Map(items.map(p=>[p.id,p]));return {categorias:categories.filter(c=>items.some(p=>p.categoria===c.id)),gerado_em:data.gerado_em,novo:byId.get(data.achado_novo)||null,populares:data.ranking.map(id=>byId.get(id)).filter(Boolean),items};
}

export function numberFromInput(value){const match=String(value).trim().match(/^(?:(?:n[\u00bao\u00b0.]?\s*)|#)?(\d{1,6})$/i);return match&&Number(match[1])>0?String(Number(match[1])):null;}
export function catalogPage(catalog,{query='',category='',limit=12,offset=0}={}){const matches=findProducts(catalog,query).filter(p=>!category||p.categoria===category);return {total:matches.length,items:matches.slice(offset,offset+limit)};}
export function nearestProducts(catalog,number){return [...catalog.items].sort((a,b)=>Math.abs(Number(a.numero)-Number(number))-Math.abs(Number(b.numero)-Number(number))).slice(0,3);}

export function toolsCanShow(scrollY,toolbar,buttons){
 return scrollY>=500&&!buttons.some(button=>button.width>0&&button.height>0&&toolbar.left<button.right&&toolbar.right>button.left&&toolbar.top<button.bottom&&toolbar.bottom>button.top);
}
