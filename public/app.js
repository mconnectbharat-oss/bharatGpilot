const $=s=>document.querySelector(s),side=$('#side');$('#menu').onclick=()=>side.classList.toggle('open');document.querySelectorAll('.chip').forEach(x=>x.onclick=()=>$('#request').value=x.textContent);$('#new').onclick=()=>$('#repo').focus();
$('#run').onclick=async()=>{const repo=$('#repo').value.trim(),request=$('#request').value.trim();if(!/^[\\w.-]+\\/[\\w.-]+$/.test(repo)){alert('Enter owner/repository');return}const steps=['Planning investigation','Repository identified','Evidence collected','Evaluating health and contribution','Final verification'];$('#steps').innerHTML='';$('#trace').textContent='Running';$('#status').textContent='Investigating';$('#run').disabled=true;steps.forEach(x=>$('#steps').insertAdjacentHTML('beforeend','<div class="step"><span>✓</span>'+x+'</div>'));try{const r=await fetch('/api/pilot/investigate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repository:repo,request})}),d=await r.json();if(!r.ok)throw Error(d.error||'Investigation failed');const ev=d.plan?.evidence||d.evidence||[],direct=ev.filter(x=>x.classification==='DIRECT').length,p=ev.length?Math.round(direct/ev.length*100):0;$('#coverage').textContent=p+'%';$('#bar').style.width=p+'%';$('#output').textContent=JSON.stringify(d.analysis||d,null,2);$('#result').style.display='block';$('#trace').textContent='Complete';$('#status').textContent='Ready'}catch(e){$('#trace').textContent='Blocked';$('#status').textContent='Needs attention';$('#output').textContent=e.message;$('#result').style.display='block'}finally{$('#run').disabled=false}};

async function loadImageKnowledge(){
  const traceCard=$('#steps')?.closest('.card');
  if(!traceCard)return;
  const panel=document.createElement('section');
  panel.className='card image-knowledge';
  panel.innerHTML='<div class="head"><span>Knowledge extracted from images</span><span class="badge">IMAGE NOTES</span></div><p class="knowledge-intro">Structured starter notes from the project reference images. Observations are separated from cross-image inferences.</p><div class="knowledge-list" id="knowledge-list"><p class="knowledge-muted">Loading image-derived notes…</p></div>';
  traceCard.before(panel);
  try{
    const response=await fetch('/image-knowledge.json',{headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('Image knowledge dataset is unavailable.');
    const data=await response.json();
    const list=panel.querySelector('#knowledge-list');
    list.replaceChildren();
    for(const item of data.items||[]){
      const article=document.createElement('article');
      article.className='knowledge-item';
      const title=document.createElement('h3');title.textContent=item.title;
      const meta=document.createElement('div');meta.className='knowledge-meta';meta.textContent=item.sourceImage+' · '+item.evidenceClass+' · '+item.confidence;
      const ul=document.createElement('ul');
      for(const observation of item.observations||[]){const li=document.createElement('li');li.textContent=observation;ul.append(li);}
      const tags=document.createElement('div');tags.className='knowledge-tags';
      for(const tag of item.tags||[]){const span=document.createElement('span');span.textContent=tag;tags.append(span);}
      article.append(title,meta,ul,tags);list.append(article);
    }
    if(data.interpretation?.length){
      const note=document.createElement('p');note.className='knowledge-inference';
      note.textContent=data.interpretation.map(x=>x.evidenceClass+': '+x.claim).join(' ');
      list.append(note);
    }
    const footer=document.createElement('p');footer.className='knowledge-muted';
    footer.textContent=(data.limitations||[]).join(' ');
    list.append(footer);
  }catch(error){
    panel.querySelector('#knowledge-list').textContent=error.message;
  }
}
loadImageKnowledge();
