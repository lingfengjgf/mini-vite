const Koa = require("koa");
const fs = require("fs");
const path = require("path");
const compilerSFC = require("@vue/compiler-sfc");
const compilerDOM = require("@vue/compiler-dom");

// 创建实例
const app = new Koa();

// 处理路由
app.use(async ctx => {
  const { url, query } = ctx.request;

  if(url === '/'){
    // 处理首页请求

    // 加载index.html
    ctx.type = 'text/html';
    ctx.body = fs.readFileSync(path.join(__dirname, './index.html'), 'utf-8');
  } else if(url.endsWith('.js')){
    // 处理js文件

    const p = path.join(__dirname, url);
    ctx.type = 'application/javascript';
    ctx.body = rewriteImport(fs.readFileSync(p, 'utf-8'));
  } else if(url.startsWith('/@modules/')){
    // 处理裸模块

    // 获得裸模块名称
    let moduleName = url.replace('/@modules/', '');
    // 去node_modules中找打包后的vue.js

    const prefix = path.join(__dirname, '../node_modules', moduleName);
    // "module": "dist/vue.runtime.esm-bundler.js",
    const module = require(prefix + '/package.json').module;
    const filePath = path.join(prefix, module);

    const res = fs.readFileSync(filePath, 'utf-8');
    ctx.type = 'application/javascript';
    ctx.body = rewriteImport(res);
  } else if(url.indexOf('.vue')>-1){
    const p = path.join(__dirname, url.split('?')[0]);
    const res = compilerSFC.parse(fs.readFileSync(p, 'utf-8'));
    // console.log("sfc res:",res);
    if(!query.type){
      // 处理vue文件,解析为js

      // 获取脚本部分的内容
      const scriptContent = res.descriptor.script.content;
      // 替换默认导出为一个常量，方便后续修改
      const script = scriptContent.replace('export default', 'const __script = ');
      ctx.type = 'application/javascript';
      ctx.body = `
        ${rewriteImport(script)}
        // 解析template
        import {render as __render} from '${url}?type=template';
        __script.render = __render;
        export default __script;
      `;
    } else if(query.type === 'template'){
      const tpl = res.descriptor.template.content;
      // 将template编译为render函数
      const render = compilerDOM.compile(tpl, { mode:'module' }).code;
      ctx.type = 'application/javascript';
      ctx.body = rewriteImport(render);
    }
  }
})

// 裸模块地址重写
// import xxx from 'vue'  ==> import xxx from '/@modules/vue';
function rewriteImport(content){
  return content.replace(/ from ['"](.*)['"]/g, function(s1, s2){
    if(s2.startsWith('/') || s2.startsWith('./') || s2.startsWith('../')){
      return s1;
    } else {
      // 裸模块地址重写
      return ` from '/@modules/${s2}'`;
    }
  })
}

app.listen(3000, () => {
  console.log('mini-vite startup!!!');
})