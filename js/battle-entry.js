// Classic bootstrap can show instructions even when Chrome blocks file:// modules.
(function(){
  if(location.protocol==='file:'){
    document.getElementById('overlayTitle').textContent='请通过本地网址启动游戏';
    document.getElementById('overlayText').textContent='Chrome 无法从直接打开的 HTML 文件加载 3D 模块。请双击游戏文件夹中的 start-game.cmd，并保持启动窗口开启。';
    const link=document.createElement('a');
    link.className='race-button';link.href='http://127.0.0.1:8765/battle.html';link.textContent='服务已启动？打开 3D 赛场';
    document.getElementById('overlay').append(link);
    document.getElementById('start').textContent='请先使用 start-game.cmd 启动';
    return;
  }
  const script=document.createElement('script');script.type='module';script.src='js/battle.js?v=ai-minus2-20261104';
  script.onerror=()=>{
    document.getElementById('overlayTitle').textContent='比赛程序加载失败';
    document.getElementById('overlayText').textContent='请确认本地启动窗口仍在运行，然后刷新页面。';
  };
  document.body.append(script);
})();
