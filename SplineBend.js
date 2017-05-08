#pragma strict

@script ExecuteInEditMode

//enum UpdateType {onStartOnly=0, editorIfSelected=1, editorAlways=2, editorAndPlaymode=3};

var markers : SplineBendMarker[]; 

@HideInInspector var showMeshes : boolean = false;
@HideInInspector var showTiles : boolean = false;
@HideInInspector var showTerrain : boolean = false;
@HideInInspector var showUpdate : boolean = false;
@HideInInspector var showExport : boolean = false;

@HideInInspector var initialRenderMesh : Mesh;
@HideInInspector var renderMesh : Mesh;
@HideInInspector var initialCollisionMesh : Mesh;
@HideInInspector var collisionMesh : Mesh;

@HideInInspector var tiles : int = 1;
@HideInInspector var tileOffset : float = -1;
@HideInInspector private var oldTiles : int = 1;
//@HideInInspector private var oldTileOffset : float = -1;

@HideInInspector var dropToTerrain : boolean = false;
@HideInInspector var terrainSeekDist : float = 1000;
@HideInInspector var terrainLayer : int = 0;
@HideInInspector var terrainOffset : float = 0;

@HideInInspector var equalize : boolean = true;
@HideInInspector var closed : boolean;
@HideInInspector private var wasClosed : boolean;
@HideInInspector var markerSize : float = 1;

@HideInInspector var displayRolloutOpen : boolean = false;
@HideInInspector var settingsRolloutOpen : boolean = false;
@HideInInspector var terrainRolloutOpen : boolean = false;

enum SplineBendAxis {x, y, z}
var axis : SplineBendAxis = SplineBendAxis.z;
private var axisVector : Vector3;

//@HideInInspector var startCap : Transform;
//@HideInInspector var endCap : Transform;

//@HideInInspector var updateType : UpdateType = UpdateType.editorIfSelected;

@HideInInspector var objFile : Transform;

static function GetBeizerPoint (p0:Vector3, p1:Vector3, p2:Vector3, p3:Vector3, t:float)
{
	var it : float = 1-t;
	return it*it*it*p0 + 3*t*it*it*p1 + 3*t*t*it*p2 + t*t*t*p3;
}

static function GetBeizerLength (p0:Vector3, p1:Vector3, p2:Vector3, p3:Vector3)
{
	var length : float = 0;
	var oldPoint : Vector3 = p0;
	var curPoint : Vector3;
	for (var i:float = 0; i<1.01; i+=0.1)
	{
		curPoint = GetBeizerPoint(p0,p1,p2,p3,i);
		length += (oldPoint - curPoint).magnitude;
		oldPoint = curPoint;
	}
	return length;
	
	//sqrt(a*x^4+b*x^3+c*x^2+d*x+e)
	//sqrt(1/5a + 1/4b + 1/2d + 1/3c + e)
}
static function GetBeizerLength (marker1:SplineBendMarker, marker2:SplineBendMarker)
{
	var dist : float = (marker2.position-marker1.position).magnitude * 0.5;
	return GetBeizerLength(
			marker1.position, 
			marker1.nextHandle + marker1.position,
			marker2.prewHandle + marker2.position, 
			marker2.position);
}


static function AlignPoint (marker1:SplineBendMarker, marker2:SplineBendMarker, percent:float, coords:Vector3)
{
	//var dist : float = marker1.dist + marker1.distAdjustRight*coords.z + marker1.distAdjustUp*coords.y;
	var dist : float = (marker2.position-marker1.position).magnitude * 0.5;
	
	//picking two points on a beizer curve
	var pointBefore : Vector3 = GetBeizerPoint(
			marker1.position, 
			marker1.nextHandle + marker1.position,
			marker2.prewHandle + marker2.position,  
			marker2.position, 
			Mathf.Max (0,percent-0.01) );
	
	var pointAfter : Vector3 = GetBeizerPoint(
			marker1.position, 
			marker1.nextHandle + marker1.position,
			marker2.prewHandle + marker2.position, 
			marker2.position, 
			Mathf.Min (1,percent+0.01) );
	
	//getting main curve point and its tangent
	//var point : Vector3 = (pointAfter + pointBefore)*0.5; //inaccurate
	var point : Vector3 = GetBeizerPoint(
			marker1.position, 
			marker1.nextHandle + marker1.position,
			marker2.prewHandle + marker2.position, 
			marker2.position, 
			percent);
	var tangent : Vector3 = pointBefore-pointAfter;
	
	//getting right and up vectors
	var orientation : Vector3 = Vector3.Slerp(marker1.up, marker2.up, percent);
	var perpRight : Vector3 = Vector3.Cross(tangent, orientation).normalized;
	var perpUp : Vector3 = Vector3.Cross(perpRight, tangent).normalized;
	
	//calculating marker-based scale
	var scale : Vector3 = Vector3(1,1,1);
	if (marker1.expandWithScale || marker2.expandWithScale)
	{
		var sp1 : float = percent*percent;
		var sp2 : float = 1-(1-percent)*(1-percent);
		var sp : float = sp2*percent + sp1*(1-percent);

		scale.x = marker1.transform.localScale.x*(1-sp) + marker2.transform.localScale.x*sp;
		scale.y = marker1.transform.localScale.y*(1-sp) + marker2.transform.localScale.y*sp;
	}

	//returning result
	return point + 
		perpRight*coords.x*scale.x +
		perpUp*coords.y*scale.y;
}

function BuildMesh (mesh:Mesh, initialMesh:Mesh, num:int, offset:float)
{
	var v:int = 0;
	
	//get initial arrays
	var vertices:Vector3[] = initialMesh.vertices;
	var uvs:Vector2[] = initialMesh.uv;
	var uv2:Vector2[] = initialMesh.uv2;
	var tris:int[] = initialMesh.triangles;
	var tangents:Vector4[] = initialMesh.tangents;
	
	//changing axis

	//setting tiled arrays
	var tiledVerts : Vector3[] = new Vector3[vertices.length*num];
	var tiledUvs : Vector2[] = new Vector2[vertices.length*num];
	var tiledUv2 : Vector2[] = new Vector2[vertices.length*num];
	var tiledTangents : Vector4[] = new Vector4[vertices.length*num];
	var hasSecondUv : boolean = uv2.length > 0;
	for (var i:int = 0; i<num; i++)
		for (v=0; v<vertices.length; v++)
		{
			tiledVerts[i*vertices.length + v] = vertices[v];// + Vector3(0, 0, 1)*tileOffset*i; //we'll do it in Align

			tiledUvs[i*vertices.length + v] = uvs[v];
			//if (hasSecondUv) tiledUv2[i*vertices.length + v] = uv2[v];
			tiledTangents[i*vertices.length + v] = tangents[v];
		}
	var tiledTris : int[] = new int[tris.length*num];
	for (i = 0; i<num; i++)
		for (v=0; v<tris.length; v++)
			tiledTris[i*tris.length+v] = tris[v] + (vertices.length*i);
	
	//assigning arrays
	mesh.Clear();
	mesh.vertices = tiledVerts;
	mesh.uv = tiledUvs;
	mesh.uv2 = tiledUv2;
	mesh.triangles = tiledTris;
	mesh.tangents = tiledTangents;
	
//	mesh.vertices = initialMesh.vertices;
//	mesh.uv = initialMesh.uv;
//	mesh.triangles = initialMesh.triangles;

	mesh.RecalculateNormals();
}

function RebuildMeshes () //on changing tile count, actually
{
	if (!!renderMesh)
	{
		var fil:MeshFilter = GetComponent(MeshFilter);
		if (!fil) return;
		renderMesh.Clear();
		BuildMesh(renderMesh, initialRenderMesh, tiles, tileOffset);
		fil.sharedMesh = renderMesh;
		renderMesh.RecalculateBounds();
		renderMesh.RecalculateNormals();
	}
	if (!!collisionMesh)
	{
		var col:MeshCollider = GetComponent(MeshCollider);
		if (!col) return;
		collisionMesh.Clear();
		BuildMesh(collisionMesh, initialCollisionMesh, tiles, tileOffset);
		col.sharedMesh = null;
		col.sharedMesh = collisionMesh;
		collisionMesh.RecalculateBounds();
		collisionMesh.RecalculateNormals();
	}
}


function Align (mesh:Mesh, initialMesh:Mesh)
{
	//generating 'straight' mesh array. Do not use sourceVerts anymore
	var verts : Vector3[] = new Vector3[mesh.vertexCount];
	var sourceVerts : Vector3[] = initialMesh.vertices;
	for (var i:int = 0; i<tiles; i++)
		for (var v:int=0; v<sourceVerts.length; v++)
		{
			var nv : int = i*sourceVerts.length + v;
			verts[nv] = sourceVerts[v] + axisVector*tileOffset*i;
			if (axis == SplineBendAxis.x) verts[nv] = Vector3(-verts[nv].z, verts[nv].y, verts[nv].x);
			else if (axis == SplineBendAxis.y) verts[nv] = Vector3(-verts[nv].x, verts[nv].z, verts[nv].y); 
		}
	
	//reseting bounds size
	var boundsSize : float;
	var minPoint : float = Mathf.Infinity;
	var maxPoint : float = Mathf.NegativeInfinity;
	for (v = 0; v<verts.length; v++)
	{
		minPoint = Mathf.Min(minPoint, verts[v].z);
		maxPoint = Mathf.Max(maxPoint, verts[v].z);
	}
	boundsSize = maxPoint - minPoint;
	
	//placing verts
	for (v = 0; v<verts.length; v++)
	{
		//calculating percent of each mesh vert
		var percent : double = (verts[v].z - minPoint) / boundsSize;
		percent = Mathf.Clamp01(percent);
		if (Mathf.Approximately(boundsSize, 0)) percent = 0; //devision by zero
		
		//calculating marker num
		var markerNum : int = 0;
		for (var m:int=1; m<markers.length; m++)
			if (markers[m].percent >= percent) { markerNum = m-1; break; } //note that markerNum cannot be the last marker
			
		if (closed && percent < markers[1].percent) markerNum = 0;
		
		//calculating relative percent
		var relativePercent : float = (percent - markers[markerNum].percent) / (markers[markerNum+1].percent - markers[markerNum].percent);
		if (closed && percent < markers[1].percent) relativePercent = percent / markers[1].percent;
		
		//equalizing
		if (equalize)
		{
			var sp : int; //prew subpoint
			var distFromSubpoint : float;
			for (var s:int=1;s<markers[markerNum].subPoints.length;s++)
				if (markers[markerNum].subPointPercents[s] >= relativePercent) { sp = s-1; break; }
			distFromSubpoint = (relativePercent - markers[markerNum].subPointPercents[sp]) * markers[markerNum].subPointFactors[sp];
			relativePercent = markers[markerNum].subPointMustPercents[sp] + distFromSubpoint; 
		}
		
		//setting
		verts[v] = AlignPoint(markers[markerNum], markers[markerNum+1], relativePercent, verts[v]);
	}

	mesh.vertices = verts;
}


function FallToTerrain (mesh:Mesh, initialMesh:Mesh, seekDist:float, layer:int, offset:float)
{
	var verts : Vector3[] = mesh.vertices;
	
	//generating array of original vert heights
	var heights : float[] = new float[mesh.vertexCount];
	var sourceVerts : Vector3[] = initialMesh.vertices; //Will not use sourceVerts anymore
	switch (axis)
	{
		case SplineBendAxis.z: case SplineBendAxis.x:
			for (var i:int = 0; i<tiles; i++)
				for (var v:int=0; v<sourceVerts.length; v++)
					heights[i*sourceVerts.length + v] = sourceVerts[v].y;
			break;
		case SplineBendAxis.y:
			for (i = 0; i<tiles; i++)
				for (v=0; v<sourceVerts.length; v++)
					heights[i*sourceVerts.length + v] = sourceVerts[v].z;
			break;
	}
			
	//flooring verts
	var oldLayer : int = gameObject.layer;
	gameObject.layer = 1<<2;
	var hit : RaycastHit;
	for (v=0;v<verts.length;v++)
	{
    	var globalVert : Vector3 = transform.TransformPoint(verts[v]);
    	globalVert.y = transform.position.y;
    	if (Physics.Raycast (globalVert+Vector3(0,seekDist*0.5,0), -Vector3.up, hit, seekDist, 1<<layer))
    		verts[v].y = heights[v] + transform.InverseTransformPoint(hit.point).y + offset; 
    }
    gameObject.layer = oldLayer;
    
    mesh.vertices = verts;
}

function ResetMarkers () { ResetMarkers(markers.length); }
function ResetMarkers (count:int)
{
	markers = new SplineBendMarker[count];

	//determining what mesh's bb shall be used
	var initialMesh:Mesh;
	if (!!initialRenderMesh) initialMesh = initialRenderMesh;
	else if (!!initialCollisionMesh) initialMesh = initialCollisionMesh;
	
	//getting mesh bounds
	var bounds : Bounds; var boundsFound : boolean;
	if (!!initialRenderMesh) { bounds = initialRenderMesh.bounds; boundsFound = true; }
	else if (!!initialCollisionMesh) { bounds = initialCollisionMesh.bounds; boundsFound = true; }
	
	if (!boundsFound && !!GetComponent(MeshFilter)) {bounds = GetComponent(MeshFilter).sharedMesh.bounds; boundsFound = true; }
	if (!boundsFound && !!GetComponent(MeshCollider)) {bounds = GetComponent(MeshCollider).sharedMesh.bounds; boundsFound = true; }
	if (!boundsFound) bounds = new Bounds (Vector3.zero, Vector3 (1, 1, 1));
	
	var placementStart : float = bounds.min.z;
	var placementStep : float = bounds.size.z / (count-1);
	
	for (var m:int=0; m<count; m++)
	{
		var markerTfm:Transform = new GameObject("Marker"+m).transform;
		markerTfm.parent = transform;
		markerTfm.localPosition = Vector3(0, 0, placementStart + placementStep*m);
		markers[m] = markerTfm.gameObject.AddComponent(SplineBendMarker);
	}
}

function AddMarker (coords:Vector3)
{
	//finding closest marker
	var prewMarkerNum : int; //marker after which new marker will be added
	var distSq : float = Mathf.Infinity;
	var curDistSq : float;
	for (var m:int=0; m<markers.length; m++)
	{
		curDistSq = (markers[m].position - coords).sqrMagnitude;
		if (curDistSq < distSq) {prewMarkerNum=m; distSq=curDistSq;}
	}
	
	AddMarker(prewMarkerNum, coords);
}

function AddMarker (camRay:Ray) //adding marker closest to the given ray
{
	//finding marker
	var closestDist : float = Mathf.Infinity;
	//var currentDist : float;
	var closestMarker:int; 
	var closestSubpoint:int;

	for (var m:int=0; m<markers.length; m++)
	{
		var marker = markers[m];
				
		for (var s:int=0; s<marker.subPoints.length; s++)
		{		
			//finding shortest distance between camRay and point
			var subPointPos : Vector3 = transform.TransformPoint(marker.subPoints[s]);
			var rayLength : float = Vector3.Dot(camRay.direction, (subPointPos - camRay.origin).normalized) 
				* (camRay.origin - subPointPos).magnitude;
			var currentDist = (camRay.origin + camRay.direction*rayLength - subPointPos).magnitude;
			
			if (currentDist < closestDist)
			{
				closestMarker = m;
				closestSubpoint = s;
				closestDist = currentDist;
				//closestPointPos = transform.TransformPoint(marker.subPoints[s]);
			}
		}
	}
		
	var pointPos : Vector3 = transform.TransformPoint(markers[closestMarker].subPoints[closestSubpoint]);
	var dist : float = (camRay.origin - pointPos).magnitude;	
							
	AddMarker(closestMarker, camRay.origin + camRay.direction*dist);
			
	UpdateNow(); UpdateNow ();
}

function AddMarker (prewMarkerNum:int, coords:Vector3)
{	
	/*
	//re-assigning prewNum to previous in array if necessary
	if (prewMarkerNum>=1)
	{
		if ((coords - markers[prewMarkerNum-1].position).sqrMagnitude <
			(markers[prewMarkerNum-1].position - markers[prewMarkerNum].position).sqrMagnitude) 
				prewMarkerNum = prewMarkerNum-1;
	}
	else //if prewMarkerNum==0
	{
		if ((coords - markers[1].position).sqrMagnitude >
			(markers[0].position - markers[1].position).sqrMagnitude) 
				prewMarkerNum = -1;
	}
	*/
	
	//re-creating markers array
	var newMarkers : SplineBendMarker[] = new SplineBendMarker[markers.length+1];
	for (var m:int=0; m<markers.length; m++)
	{
		if (m<=prewMarkerNum) newMarkers[m] = markers[m];
		else newMarkers[m+1] = markers[m];
	}
	
	//creating gameobject
	var markerTfm:Transform = new GameObject("Marker"+(prewMarkerNum+1)).transform;
	markerTfm.parent = transform;
	markerTfm.position = coords;
	newMarkers[prewMarkerNum+1] = markerTfm.gameObject.AddComponent(SplineBendMarker);

	markers = newMarkers;
}

function RefreshMarkers () //re-creates markers array ignoring non-existent ones
{
	var newCount : int = 0;
	
	for (var m:int=0; m<markers.length; m++)
		if (!!markers[m]) newCount++;
		
	var newMarkers : SplineBendMarker[] = new SplineBendMarker[newCount];
	
	var counter : int = 0;
	for (m=0; m<markers.length; m++)
	{
		if (!markers[m]) continue;
		newMarkers[counter] = markers[m];
		counter++;
	}
	
	markers = newMarkers;
}

function RemoveMarker (num:int)
{
	//destroing game object
	DestroyImmediate(markers[num].gameObject);
	
	//re-creating markers array
	var newMarkers : SplineBendMarker[] = new SplineBendMarker[markers.length-1];
	for (var m:int=0; m<markers.length-1; m++)
	{
		if (m<num) newMarkers[m] = markers[m];
		else newMarkers[m] = markers[m+1];
	}
	
	markers = newMarkers;
}

function CloseMarkers ()
{
	if (closed || markers[0] == markers[markers.length-1]) return; //already closed
	
	var newMarkers : SplineBendMarker[] = new SplineBendMarker[markers.length+1];
	for (var m:int=0; m<markers.length; m++) newMarkers[m] = markers[m];
	markers = newMarkers;
	
	markers[markers.length-1] = markers[0];
	
	UpdateNow();
	
	closed = true;
}

function UnCloseMarkers ()
{
	if (!closed || markers[0] != markers[markers.length-1]) return; //already unclosed
	
	var newMarkers : SplineBendMarker[] = new SplineBendMarker[markers.length-1];
	for (var m:int=0; m<markers.length-1; m++) newMarkers[m] = markers[m];
	markers = newMarkers;
	
	UpdateNow();
	
	closed = false;
}





function OnEnable () 
{
	//removing render and collision mehses to prevent using same mesh by many SplineBends
	renderMesh = null;
	collisionMesh = null;
	
	ForceUpdate(); 

	var f : MeshFilter = GetComponent(MeshFilter);
	var c : MeshCollider = GetComponent(MeshCollider);
	
	if (!!renderMesh && !!f) f.sharedMesh = renderMesh;
	if (!!collisionMesh && !!c) { c.sharedMesh = null; c.sharedMesh = collisionMesh; }
}

function OnDisable ()
{
	var f : MeshFilter = GetComponent(MeshFilter);
	var c : MeshCollider = GetComponent(MeshCollider);
	
	if (!!initialRenderMesh && !!f) f.sharedMesh = initialRenderMesh;
	if (!!initialCollisionMesh && !!c) { c.sharedMesh = null; c.sharedMesh = initialCollisionMesh; }
}

function UpdateNow () { ForceUpdate(true); }
function ForceUpdate () { ForceUpdate(true); }
function ForceUpdate (refreshCollisionMesh:boolean)
{
	var collider:MeshCollider = GetComponent(MeshCollider);
	var filter:MeshFilter = GetComponent(MeshFilter);
	
	//setting axis vector
	switch (axis) 
	{
		case SplineBendAxis.x: axisVector = Vector3(1,0,0); break;
		case SplineBendAxis.y: axisVector = Vector3(0,1,0); break;
		case SplineBendAxis.z: axisVector = Vector3(0,0,1); break;
	}

	//limiting tiles numbers
	if (!!initialRenderMesh) tiles = Mathf.Min(tiles, Mathf.FloorToInt(65000f/initialRenderMesh.vertices.length));
	else if (!!initialCollisionMesh) tiles = Mathf.Min(tiles, Mathf.FloorToInt(65000f/initialCollisionMesh.vertices.length));
	tiles = Mathf.Max(tiles,1);
	
	//refreshing or recreating markers
	if (!markers) ResetMarkers(2);
	for (var m:int=0; m<markers.length; m++) 
		if (!markers[m]) RefreshMarkers();
	if (markers.length < 2) ResetMarkers(2);
	
	//initializing markers, setting position, handles and distance
	for (m=0; m<markers.length; m++) markers[m].Init(this,m);
	if (closed) markers[0].dist = markers[markers.length-2].dist + GetBeizerLength(markers[markers.length-2],markers[0]);
	
	//setting marker percents
	var totalDist:float = markers[markers.length-1].dist;
	if (closed) totalDist = markers[0].dist;
	for (m=0; m<markers.length; m++) markers[m].percent = markers[m].dist / totalDist;
	
	//closing - unclosing
	if (closed && !wasClosed) CloseMarkers();
	if (!closed && wasClosed) UnCloseMarkers();
	wasClosed = closed; 
	
	//init meshes
	if (!!filter && !renderMesh) //if there is a filter but no render mesh
	{
		if (!initialRenderMesh) initialRenderMesh = filter.sharedMesh; //if no mesh (object just loaded) then copy mesh to initial and assigning new one
		if (!!initialRenderMesh) 
		{
			//reseting tile offset (if it is negative - upon first creation)
			if (tileOffset < 0) tileOffset = initialRenderMesh.bounds.size.z;
			
			//creating working mesh
			renderMesh = Instantiate (initialRenderMesh);
			renderMesh.hideFlags = HideFlags.HideAndDontSave; //meshes must not save with a scene

			filter.sharedMesh = renderMesh;
		}
	}
	
	if (!!collider && !collisionMesh) //if there is collider but no collision mesh
	{
		if (!initialCollisionMesh) initialCollisionMesh = collider.sharedMesh;
		if (!!initialCollisionMesh)
		{
			//reseting tile offset (if it is negative - upon first creation)
			if (tileOffset < 0) tileOffset = initialCollisionMesh.bounds.size.z;
			
			//creating working mesh
			collisionMesh = Instantiate (initialCollisionMesh);
			collisionMesh.hideFlags = HideFlags.HideAndDontSave; //meshes must not save with a scene
	
			collider.sharedMesh = collisionMesh;
		}
	}
	
	
	//updating render mesh: rebuilding if needed, aligning, dropping
	if (!!renderMesh && !!initialRenderMesh && !!filter)
	{
		if (renderMesh.vertexCount != initialRenderMesh.vertexCount*tiles) BuildMesh(renderMesh, initialRenderMesh, tiles, 0);
		Align(renderMesh, initialRenderMesh);
		if (dropToTerrain) FallToTerrain(renderMesh, initialRenderMesh, terrainSeekDist, terrainLayer, terrainOffset);
		
		//refreshing
		renderMesh.RecalculateBounds();
		renderMesh.RecalculateNormals();
	}
	
	
	//updating collision mesh. The same
	if (!!collisionMesh && !!initialCollisionMesh && !!collider) 
	{ 
		if (collisionMesh.vertexCount != initialCollisionMesh.vertexCount*tiles) BuildMesh(collisionMesh, initialCollisionMesh, tiles, 0);
		Align(collisionMesh, initialCollisionMesh);
		if (dropToTerrain) FallToTerrain(collisionMesh, initialCollisionMesh, terrainSeekDist, terrainLayer, terrainOffset);
		
		//refreshing
		if (refreshCollisionMesh && collider.sharedMesh==collisionMesh) //if refresh needed and collider mesh assigned to collider
		{
			collisionMesh.RecalculateBounds();
			collisionMesh.RecalculateNormals(); 
			collider.sharedMesh=null; 
			collider.sharedMesh=collisionMesh; 
		}
	}
}
