const fs=require('fs'); const p='src/world/TropicalWorld.ts'; let s=fs.readFileSync(p,'utf8');
const methods=`  private spawnGiantIslandLandmarks(): void {
    const island = getIsland('rieseninsel');
    const rng = new SeededRandom(307_889);
    const camp = new Group();
    camp.name = 'Elias’ Lager';
    camp.position.set(island.positionMeters.x + GIANT_CAMP.x, GIANT_CAMP.y, island.positionMeters.z + GIANT_CAMP.z);
    const place = (name: string, model: Object3D, x: number, z: number, height: number, footprint: number, rotation = 0): void => {
      normalizeHeight(model, height);
      // Preserve model-origin correction inside an anchor and bound each reserved footprint.
      let bounds = new Box3().setFromObject(model);
      const size = bounds.getSize(new Vector3());
      const fit = Math.min(1, footprint / Math.max(size.x, size.z));
      model.scale.multiplyScalar(fit);
      bounds = new Box3().setFromObject(model);
      model.position.x -= (bounds.min.x + bounds.max.x) / 2;
      model.position.z -= (bounds.min.z + bounds.max.z) / 2;
      model.position.y -= bounds.min.y;
      const anchor = new Group(); anchor.name = name; anchor.add(model);
      anchor.position.set(x, 0, z); anchor.rotation.y = rotation;
      camp.add(anchor);
      if (height > 0.7) this.physics.addFixedCylinder({ x: camp.position.x+x, y: GIANT_CAMP.y+height/2, z: camp.position.z+z },height/2,footprint*0.42);
    };
    place('Elias’ Zelt', this.assets.createModel('survival.tent') ?? createShelterVisual(), -9, -6, 2.7, 6, 0.25);
    place('Vorratskiste', this.assets.createModel('survival.box-large') ?? createChestVisual(), -13, 2, 1.05, 1.8, -0.15);
    place('Wasserfass', this.assets.createModel('survival.barrel') ?? createChestVisual(), -9, 4, 1.15, 1.4);
    place('Arbeitstisch', this.assets.createModel('survival.workbench-anvil') ?? createWorkbenchVisual(), 9, -6, 1.15, 3, -0.6);
    place('Brennholz', this.assets.createModel('survival.resource-wood') ?? createBedVisual(), 12, 0, 0.6, 2.4, 1.2);
    place('Wassereimer', this.assets.createModel('survival.bucket') ?? createChestVisual(), 9, 6, 0.55, 0.8);
    place('Sitzbank', createBedVisual(), -4, 6, 0.55, 2.5, Math.PI/2);
    const fire = createCampfireVisual();
    place('Elias’ Lagerfeuer', fire, 0, 0, 1, 1.8);
    const light = new PointLight(0xffb967, 5, 23, 2); light.position.set(0, 1.6, 0); camp.add(light);
    this.scene.add(camp);
    this.streamedScenery.push({ object: camp, center: camp.position.clone(), distance: 450 });

    const npc = createEliasVisual();
    npc.name = 'Elias Voss';
    npc.position.set(camp.position.x+3.8, GIANT_CAMP.y, camp.position.z+3.8);
    npc.rotation.y = -2.3; npc.userData.entityId = 'elias';
    this.scene.add(npc); this.interactiveObjects.push(npc);
    const collider = this.physics.addFixedCylinder({ x: npc.position.x, y: npc.position.y+0.9, z: npc.position.z },0.9,0.36);
    this.entities.set('elias', { id: 'elias', kind: 'elias', object: npc, available: true, amount: 1, hitPoints: 1, maxHitPoints: 1, cooldown: 0, collider });

    this.spawnRockSpires(island, [
      { x: -225, z: 280, height: 36, radius: 10 },
      { x: 150, z: 300, height: 42, radius: 12 },
      { x: 405, z: 75, height: 32, radius: 9 },
    ]);
    const basinDefinition = FRESHWATER_BASINS[0]!;
    const seed = freshwaterBasinShoreSeed(basinDefinition, island);
    const shore: KitSceneryPlacement[] = [];
    for (let i=0; i<68; i++) {
      const angle = i/68*Math.PI*2;
      const radius = organicBasinRadiusFactor(angle,seed)*1.055;
      const x = Math.cos(angle)*GIANT_LAKE.radiusX*radius;
      const z = Math.sin(angle)*GIANT_LAKE.radiusZ*radius;
      if (isInKitLandmarkClearing(island,x,z,8)) continue;
      shore.push({assetId: i%4===0 ? 'nature.rock-large-c' : i%3===0 ? 'nature.flower-red' : 'nature.plant-flat-tall',
        x,z,height: i%4===0 ? rng.range(1.1,2.8) : rng.range(0.8,1.7),rotationY: angle});
    }
    this.spawnKitSceneryCluster('Smaragdsee · Ufergarten',island,shore,1400);
    const lilies: KitSceneryPlacement[]=[];
    for(let i=0;i<42;i++) {
      const angle=rng.range(0,Math.PI*2), radius=organicBasinRadiusFactor(angle,seed)*rng.range(0.77,0.86);
      lilies.push({assetId:'nature.lily-large',x:Math.cos(angle)*180*radius,z:Math.sin(angle)*135*radius,height:0.24,rotationY:angle});
    }
    this.spawnKitSceneryCluster('Smaragdsee · Seerosen',island,lilies,1400,GIANT_LAKE.surfaceY+0.04);
    // A pair of emergent trees frames the last turn before the camp.
    this.spawnJungleForest('rieseninsel-baumtor',[
      {position:new Vector3(4316,this.heightAt(4316,3643),3643),height:37,rotation:0.3},
      {position:new Vector3(4306,this.heightAt(4306,3667),3667),height:34,rotation:1.2},
    ],new Vector3(4311,0,3655),1400);
    for(let i=0;i<32;i++) {
      const butterfly = createButterflyVisual(i%3);
      const x=camp.position.x+rng.range(-20,20), z=camp.position.z+rng.range(-18,18);
      butterfly.position.set(x,GIANT_CAMP.y+rng.range(1.1,2.7),z);
      butterfly.name='Dschungel-Schmetterling'; butterfly.userData.home=butterfly.position.clone();
      butterfly.userData.phase=rng.range(0,Math.PI*2); this.scene.add(butterfly); this.butterflies.push(butterfly);
    }
    // A separate coastal shark preserves the existing channel shark and save semantics.
    const shark=createSharkVisual();
    const x=island.positionMeters.x-810,z=island.positionMeters.z-160;
    shark.position.set(x,-1.2,z); shark.userData.entityId='rieseninsel-coast-shark'; this.scene.add(shark); this.interactiveObjects.push(shark);
    this.entities.set('rieseninsel-coast-shark',{id:'rieseninsel-coast-shark',kind:'shark',object:shark,available:true,amount:1,hitPoints:160,maxHitPoints:160,cooldown:0,home:shark.position.clone()});
  }

  private animateGiantIsland(time: number, player: Vec3Like): void {
    const elias=this.entities.get('elias');
    if(elias && distanceSquaredXZ(elias.object.position,player)<18**2) {
      elias.object.rotation.y=Math.atan2(player.x-elias.object.position.x,player.z-elias.object.position.z);
      const torso=elias.object.getObjectByName('elias-torso');
      if(torso) torso.rotation.z=Math.sin(time*1.4)*0.015;
    }
    for(const butterfly of this.butterflies) {
      butterfly.visible=distanceSquaredXZ(butterfly.position,player)<95**2;
      if(!butterfly.visible) continue;
      const home=butterfly.userData.home as Vector3, phase=butterfly.userData.phase as number;
      butterfly.position.set(home.x+Math.sin(time*0.7+phase)*2,home.y+Math.sin(time*1.3+phase)*0.5,home.z+Math.cos(time*0.5+phase)*1.7);
      butterfly.rotation.y=time*0.5+phase;
      butterfly.children[0]!.rotation.z=Math.sin(time*12+phase)*0.85;
      butterfly.children[1]!.rotation.z=-Math.sin(time*12+phase)*0.85;
    }
    const flame=this.scene.getObjectByName('Elias’ Lagerfeuer')?.getObjectByName('campfire-flame');
    if(flame) flame.scale.set(1+Math.sin(time*9)*0.08,1+Math.sin(time*13)*0.15,1);
  }

`;
s=s.replace('  private spawnAbandonedKitSites(): void {',methods+'  private spawnAbandonedKitSites(): void {');
s=s.replace('if (entity.kind === "building" || entity.kind === "raft" || entity.kind === "lore_letter"', 'if (entity.kind === "elias" || entity.kind === "building" || entity.kind === "raft" || entity.kind === "lore_letter"');
// Update all shark entities without rewriting old save fields.
s=s.replace('    const shark = this.shark;\n    if (!shark?.available) return;',`    for (const shark of this.entities.values()) {
    if (shark.kind !== 'shark' || !shark.available || distanceSquaredXZ(shark.object.position,player)>400**2) continue;`);
s=s.replace('const canHunt = (swimming || onRaft) && this.isDeepWater', 'const canHunt = this.getWaterSurfaceAt(player.x,player.z) === SEA_LEVEL && (swimming || onRaft) && this.isDeepWater');
s=s.replace('else target = new Vector3(170 + Math.sin(this.elapsedSeconds * 0.12) * 70, -1.25, 18 + Math.cos(this.elapsedSeconds * 0.17) * 48);','else target = new Vector3((shark.id === "channel-shark" ? 170 : shark.home!.x) + Math.sin(this.elapsedSeconds * 0.12) * 70, -1.25, (shark.id === "channel-shark" ? 18 : shark.home!.z) + Math.cos(this.elapsedSeconds * 0.17) * 48);');
s=s.replace('  private updateLighting(timeOfDay:', '  }\n\n  private updateLighting(timeOfDay:');
// Camp keeps analytic terrain exactly flat even at the edge of the lake carve.
s=s.replace('  return carveFreshwaterTerrain(x, z, island, rawHeight);',`  if (island.id === 'rieseninsel' && Math.hypot(x-island.positionMeters.x-GIANT_CAMP.x,z-island.positionMeters.z-GIANT_CAMP.z)<30) return GIANT_CAMP.y;
  return carveFreshwaterTerrain(x, z, island, rawHeight);`);
const visuals=`function createEliasVisual(): Group {
  const root=new Group();
  const skin=new MeshStandardMaterial({color:0xc18d67,roughness:1});
  const shirt=new MeshStandardMaterial({color:0x62785a,roughness:1});
  const trousers=new MeshStandardMaterial({color:0x514d36,roughness:1});
  const leather=new MeshStandardMaterial({color:0x483022,roughness:1});
  const hat=new MeshStandardMaterial({color:0xc0a171,roughness:1});
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,material:MeshStandardMaterial,parent:Group=root):Mesh=>{
    const mesh=new Mesh(new BoxGeometry(w,h,d),material); mesh.position.set(x,y,z); mesh.castShadow=true; parent.add(mesh); return mesh;
  };
  for(const side of [-1,1]) {
    box(0.18,0.69,0.21,side*0.14,0.48,0,trousers);
    box(0.21,0.15,0.34,side*0.14,0.075,0.06,leather);
  }
  const torso=new Group();torso.name='elias-torso';root.add(torso);
  box(0.49,0.58,0.28,0,1.12,0,shirt,torso);
  box(0.5,0.07,0.3,0,0.84,0,leather,torso);
  box(0.15,0.1,0.15,0,1.46,0,skin,torso);
  const head=new Mesh(new SphereGeometry(0.2,10,8),skin);head.position.set(0,1.66,0);head.scale.set(0.83,1.1,0.84);torso.add(head);
  for(const side of [-1,1]) {
    const sleeve=box(0.18,0.32,0.23,side*0.33,1.22,0,shirt,torso);sleeve.rotation.z=side*0.1;
    box(0.13,0.32,0.16,side*0.36,0.94,0.015,skin,torso);
    box(0.035,0.025,0.035,side*0.066,1.69,0.151,leather,torso);
  }
  box(0.065,0.085,0.08,0,1.62,0.177,skin,torso);
  box(0.12,0.035,0.025,0,1.56,0.15,leather,torso);
  box(0.33,0.43,0.2,0,1.15,-0.23,leather,torso);
  for(const side of [-1,1]) box(0.045,0.53,0.035,side*0.17,1.13,0.155,hat,torso);
  const brim=new Mesh(new CylinderGeometry(0.33,0.33,0.04,12),hat);brim.position.y=1.83;torso.add(brim);
  const crown=new Mesh(new CylinderGeometry(0.19,0.21,0.17,10),hat);crown.position.y=1.925;torso.add(crown);
  return root;
}

function createButterflyVisual(variant: number): Group {
  const root=new Group();
  const material=new MeshStandardMaterial({color:[0x20bce0,0xe99d38,0x83b5ff][variant]!,side:DoubleSide,roughness:0.85});
  for(const side of [-1,1]) {
    const wing=new Group();const mesh=new Mesh(new SphereGeometry(0.13,6,4),material);
    mesh.scale.set(1,0.04,0.72);mesh.position.x=side*0.12;wing.add(mesh);root.add(wing);
  }
  return root;
}

`;
s=s.replace('function createProceduralSnake(): Group {',visuals+'function createProceduralSnake(): Group {');
fs.writeFileSync(p,s);
