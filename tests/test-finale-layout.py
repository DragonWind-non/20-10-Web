"""Check the close foreground couple, Earth and actual lunar terrain in Chrome."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--output',default=str(Path(tempfile.gettempdir())/'20-10-moon-finale'))
out=Path(parser.parse_args().output)
out.mkdir(parents=True,exist_ok=True)

MEASURE='''()=>{
    const a=appInstance,f=a.finaleManager,camera=a.scene3d.camera,w=a.wallE,e=a.eve;
    const project=p=>{p.project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};};
    const bounds=root=>{
        const box={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
        root.updateWorldMatrix(true,true);
        root.traverseVisible(mesh=>{
            const vertices=mesh.geometry?.attributes.position;
            if(!vertices || mesh.material?.visible===false || mesh.name==='hit-proxy')return;
            for(let i=0;i<vertices.count;i++){
                const p=project(new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld));
                box.left=Math.min(box.left,p.x);box.right=Math.max(box.right,p.x);
                box.top=Math.min(box.top,p.y);box.bottom=Math.max(box.bottom,p.y);
            }
        });return box;
    };
    const supportGap=roots=>{
        let gap=Infinity;
        const terrain=f.moon.geometry,grid=terrain.parameters,positions=terrain.attributes.position,indices=terrain.index;
        const x0=positions.getX(0),z0=positions.getZ(0),dx=grid.width/grid.widthSegments,dz=grid.height/grid.heightSegments;
        const ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
        const triangle=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],hit=new THREE.Vector3();
        for(const root of roots)root.traverse(mesh=>{
            const vertices=mesh.geometry?.attributes.position;if(!vertices)return;
            for(let i=0;i<vertices.count;i++){
                const p=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(f.inverseMoon);
                const col=Math.floor((p.x-x0)/dx),row=Math.floor((p.z-z0)/dz);
                if(col<0 || col>=grid.widthSegments || row<0 || row>=grid.heightSegments)throw Error('Robot left the lunar terrain');
                const offset=(row*grid.widthSegments+col)*6;
                ray.origin.set(p.x,10,p.z);
                for(let t=0;t<2;t++){
                    for(let j=0;j<3;j++)triangle[j].fromBufferAttribute(positions,indices.getX(offset+t*3+j));
                    if(ray.intersectTriangle(...triangle,false,hit))gap=Math.min(gap,p.y-hit.y);
                }
            }
        });return gap;
    };
    const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    return {wall:bounds(w.model),eve:bounds(e.model),moon:bounds(f.moon),earth:bounds(f.earth),
        gap:w.arms[0].localToWorld(w.handTip.clone()).distanceTo(e.arms[1].localToWorld(e.handTip.clone())),
        support:[supportGap(w.treads),supportGap([e.body])],armScale:[w.arms[0].scale.x,e.arms[1].scale.x],
        lookingOut:[w,e].map(r=>new THREE.Vector3(0,0,1).applyQuaternion(r.head.getWorldQuaternion(new THREE.Quaternion())).dot(forward)),
        hearts:f.hearts.map(h=>({point:project(h.getWorldPosition(new THREE.Vector3())),opacity:h.material.opacity})),
        clock:f.time};
}'''


def overlap(a,b):
    return a['left']<b['right'] and a['right']>b['left'] and a['top']<b['bottom'] and a['bottom']>b['top']


def check(page,width,height):
    measured=page.evaluate(MEASURE)
    blockers=page.locator('.wishes-stream-column, #season-stepper, #vinyl-dock, .top-hud').evaluate_all('els=>els.map(e=>e.getBoundingClientRect().toJSON())')
    for name in ['wall','eve']:
        box=measured[name]
        assert 4<=box['left']<box['right']<=width-4 and 0<=box['top']<box['bottom']<height,(name,box)
        minimum=min(height*.26,width*.30)
        assert box['bottom']-box['top']>=minimum,('Foreground robot is too small',name,box,minimum)
        assert not any(overlap(box,b) for b in blockers),('Robot overlaps reading or controls',name,box,blockers)
    assert measured['gap']<1e-5,('Hands do not meet',measured)
    assert all(-.001<gap<.025 for gap in measured['support']),('Robot floats or penetrates the moon',measured)
    assert all(value>0 for value in measured['lookingOut']),('Robots face the viewer instead of space',measured['lookingOut'])
    assert (measured['wall']['left']+measured['eve']['right'])/2>width*.56,'Couple must sit on the right'
    earth=measured['earth']
    assert (earth['left']+earth['right'])/2>width*.65 and earth['bottom']<height*.62,('Earth belongs in the distant right sky',earth)
    assert earth['bottom']-earth['top']>min(height*.5,width*.5),('Earth is too small for the wide shot',earth)
    assert measured['moon']['left']<0 and measured['moon']['right']>width and measured['moon']['bottom']>height,'Lunar ground must fill the foreground'
    assert page.evaluate('appInstance.finaleManager.moon.geometry.type==="PlaneGeometry"'),'Finale must show a lunar horizon, not a small moon globe'
    visible=[h['point'] for h in measured['hearts'] if h['opacity']>.2]
    assert len(visible)>=24,'Heart river is too sparse'
    assert max(h['x'] for h in visible)-min(h['x'] for h in visible)>width*.15
    assert min(h['y'] for h in visible)<height*.4
    assert all(0<h['x']<width and 0<h['y']<height for h in visible),visible
    assert page.locator('.grassy-hill-svg, .sleeping-tiny, .couple-silhouette').count()==0
    assert page.evaluate('!appInstance.scene3d.bgLanternsGroup.visible && !appInstance.scene3d.seasonalProps.props[5].group.visible')
    assert page.evaluate('appInstance.eve.eyeState==="normal" && appInstance.wallE.lids.every(lid=>!lid.mesh.visible)')
    assert page.locator('.finale-photo-credit a').count()==2
    return measured


with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('console',lambda message:errors.append(message.text) if message.type=='error' and 'THREE.WebGLProgram' in message.text else None)
    page.goto('http://127.0.0.1:3000/',wait_until='domcontentloaded')
    page.wait_for_function('() => (window.appInstance?.eve)')
    page.wait_for_function('() => (appInstance.finaleManager.earth.material.uniforms.surface.value.image?.naturalWidth===2048\n        && appInstance.finaleManager.galaxy.material.map.image?.naturalWidth===2560\n        && appInstance.finaleManager.earth.material.uniforms.clouds.value.image?.naturalWidth===2048\n        && appInstance.finaleManager.moon.material.normalMap?.image?.naturalWidth===1024\n        && appInstance.finaleManager.moon.material.roughnessMap?.image?.naturalWidth===1024\n        && appInstance.finaleManager.moon.material.map.image?.naturalWidth===1024)')
    page.evaluate('''()=>{
        const a=appInstance;
        window.originalLook={environment:a.scene3d.scene.environment,
            lights:[a.scene3d.ambientLight,a.scene3d.dirLight,a.scene3d.fillLight].map(light=>[light,light.visible]),materials:[]};
        for(const robot of [a.wallE,a.eve])robot.model.traverse(mesh=>{
            if(mesh.material)originalLook.materials.push([mesh,mesh.material]);
        });
    }''')
    page.locator('.step-node[data-stage="6"]').click()
    page.wait_for_function('() => (appInstance.finaleManager.elapsed>=1.6)')
    arrival=page.evaluate('({robot:appInstance.wallE.group.scale.x,earth:appInstance.finaleManager.earth.scale.x})')
    page.wait_for_function('() => (appInstance.finaleManager.elapsed>=7.2)')
    assert page.evaluate('appInstance.wallE.group.scale.x')>arrival['robot']*1.03,'The closing push-in never happens'
    assert page.evaluate('appInstance.finaleManager.earth.scale.x')>arrival['earth']*1.02,'Earth must grow during the cinematic arrival'
    assert page.evaluate('!!appInstance.finaleManager.earth?.visible'),'Cinematic finale has no Earth'
    assert page.evaluate('!!appInstance.finaleManager.moon?.visible'),'Finale has no 3D moon'
    assert page.evaluate('''()=>{
        const a=appInstance,f=a.finaleManager,hull=a.eve.body.children[0].material,paint=a.wallE.body.children[0].material;
        window.finaleMaterials=f.robotSurfaces.map(entry=>entry.cinematic);
        return hull!==a.eve.hullMat && hull.roughness>=.45 && hull.clearcoat<=.2
            && paint.roughness>=.75 && paint.metalness<.25
            && originalLook.lights.every(([light])=>!light.visible)
            && a.scene3d.scene.environment!==originalLook.environment
            && f.moonLight.castShadow && f.moonLight.shadow.map
            && f.moon.getObjectByName('lunar-stones').isInstancedMesh;
    }'''),'Finale must use satin ceramic, worn paint and its own shadow-casting night light'
    results=[]
    for name,width,height in [('desktop',1440,900),('mobile',390,844),('tiny',320,568),('landscape',844,390),('small-landscape',667,375),('tablet',1024,768)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(950)
        page.screenshot(path=str(out/f'{name}-moon.png'))
        measured=check(page,width,height)
        results.append({'viewport':name,'hands':measured['gap'],'support':measured['support'],'robotHeights':[measured[k]['bottom']-measured[k]['top'] for k in ['wall','eve']],'earth':measured['earth'],'eyesOpenAndLookingOut':True})
    before=page.evaluate(MEASURE)
    page.wait_for_timeout(500)
    after=page.evaluate(MEASURE)
    assert after['clock']>before['clock'] and before['hearts']!=after['hearts'],'Heart river is frozen'
    page.evaluate('appInstance.scene3d.meteorTimer=appInstance.scene3d.meteorInterval-.05')
    page.wait_for_timeout(350)
    assert page.evaluate('appInstance.scene3d.meteors.some(m=>m.visible && m.userData.active)'),'Meteor trails were lost'
    page.screenshot(path=str(out/'meteor-preserved.png'))
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_timeout(250)
    check(page,1024,768)
    frozen='JSON.stringify([appInstance.finaleManager.time,appInstance.finaleManager.earth.material.uniforms.cloudTime.value,appInstance.finaleManager.earth.rotation,appInstance.wallE.group.position,appInstance.eve.head.rotation,appInstance.finaleManager.hearts.map(h=>[h.position,h.quaternion,h.material.opacity])])'
    snapshot=page.evaluate(frozen)
    page.wait_for_timeout(250)
    assert snapshot==page.evaluate(frozen),'Reduced motion must freeze the cinematic scenery and couple'
    page.locator('.step-node[data-stage="3"]').click()
    page.wait_for_timeout(350)
    assert page.evaluate('!appInstance.finaleManager.scenery3D.visible && !appInstance.wallE.finaleLayout && !appInstance.eve.finaleLayout')
    assert page.evaluate('''originalLook.materials.every(([mesh,material])=>mesh.material===material)
        && originalLook.lights.every(([light,visible])=>light.visible===visible)
        && appInstance.scene3d.scene.environment===originalLook.environment'''),'Leaving finale must restore every original material, light and environment'
    assert page.evaluate('!appInstance.scene3d.bgLanternsGroup.visible && !appInstance.scene3d.seasonalProps.props[5].group.visible'),'Old finale lanterns flash on exit'
    assert page.evaluate('appInstance.wallE.arms.every(a=>a.scale.x===1) && appInstance.eve.arms.every(a=>a.scale.x===1) && appInstance.eve.body.rotation.x===0')
    page.evaluate('appInstance.goToStage(6);appInstance.goToStage(2);appInstance.goToStage(6);appInstance.goToStage(5);appInstance.goToStage(6)')
    page.wait_for_timeout(400)
    check(page,1024,768)
    assert page.evaluate('appInstance.scene3d.scene.children.filter(o=>o.name==="moon-finale").length===1')
    assert page.evaluate('appInstance.finaleManager.robotSurfaces.every((entry,i)=>entry.cinematic===finaleMaterials[i] && entry.mesh.material===entry.cinematic)'),'Reentry must reuse the material variants'
    fallback=browser.new_page(viewport={'width':390,'height':844})
    fallback.on('pageerror',lambda error:errors.append(str(error)))
    for image in ['milky-way-eso.jpg','earth-blue-marble.jpg','earth-clouds.jpg','moon-regolith-color.jpg','moon-regolith-normal.jpg','moon-regolith-roughness.jpg']:
        fallback.route(f'**/assets/backgrounds/{image}',lambda route:route.abort())
    fallback.goto('http://127.0.0.1:3000/',wait_until='domcontentloaded')
    fallback.wait_for_function('() => (window.appInstance?.eve)')
    fallback.locator('.step-node[data-stage="6"]').click()
    fallback.wait_for_timeout(1700)
    assert fallback.evaluate('appInstance.finaleManager.galaxy.material.map.isCanvasTexture && appInstance.finaleManager.earth.material.uniforms.surface.value.isDataTexture'),'Missing photos must keep the procedural sky and blue planet'
    assert fallback.evaluate('appInstance.finaleManager.earth.material.uniforms.clouds.value.isDataTexture && appInstance.finaleManager.moon.material.map.isCanvasTexture && !appInstance.finaleManager.moon.material.normalMap && !appInstance.finaleManager.moon.material.roughnessMap'),'Missing surface textures must keep a renderable procedural moon and cloudless Earth'
    fallback.screenshot(path=str(out/'missing-photo-fallback.png'))
    fallback.close()
    assert not errors,errors
    (out/'finale-results.json').write_text(json.dumps({'results':results,'cinematicArrival':True,'animatedRiver':True,'meteorsPreserved':True,'reducedMotionAndReentry':True,'surfaceAndLightingRestoration':True,'missingPhotoFallback':True,'errors':errors},indent=2),encoding='utf-8')
    print(json.dumps(results))
    browser.close()
