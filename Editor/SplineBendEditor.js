
@CustomEditor (SplineBend)
class SplineBendEditor extends Editor 
{
	var maxTiles : int = -1;
	var blockingMouseInput : boolean = false;
	
	var showTerrain : boolean = false;

    //markers
    var markers_SP : SerializedProperty;
	var markerSize_SP : SerializedProperty;
	var equalize_SP : SerializedProperty;
	var closed_SP : SerializedProperty;
    
    //meshes
    var initialRenderMesh_SP : SerializedProperty;
    var initialCollisionMesh_SP : SerializedProperty;
    var renderMesh_SP : SerializedProperty;
    var collisionMesh_SP : SerializedProperty;
    
    //tiles
    var tiles_SP : SerializedProperty;
    var tileOffset_SP : SerializedProperty;
    
    //terrain
	var dropToTerrain_SP : SerializedProperty;
	var terrainSeekDist_SP : SerializedProperty;
	var terrainLayer_SP : SerializedProperty;
	var terrainOffset_SP : SerializedProperty;
	
	//update
	var updateType_SP : SerializedProperty;
	
	//export
	var objFile_SP : SerializedProperty;

	function CalculateMaxTiles () : void //retrns nothing, but sets maxTiles var
	{
		var maxCol:int=0; var maxRen:int=0;
		if (!!target.initialCollisionMesh) maxCol = Mathf.FloorToInt(65000/target.initialCollisionMesh.vertexCount);
		if (!!target.initialRenderMesh) maxRen = Mathf.FloorToInt(65000/target.initialRenderMesh.vertexCount);
		maxTiles = Mathf.Min(maxCol, maxRen);
	}
	
	function OnEnable () 
	{
		markers_SP  = serializedObject.FindProperty ("markers");
		markerSize_SP = serializedObject.FindProperty ("markerSize");
		closed_SP = serializedObject.FindProperty ("closed");
		equalize_SP = serializedObject.FindProperty ("equalize");
	    
		initialRenderMesh_SP = serializedObject.FindProperty ("initialRenderMesh");
		initialCollisionMesh_SP = serializedObject.FindProperty ("initialCollisionMesh");
		renderMesh_SP = serializedObject.FindProperty ("renderMesh");
		collisionMesh_SP = serializedObject.FindProperty ("collisionMesh");
	    
		tiles_SP = serializedObject.FindProperty ("tiles");
		tileOffset_SP = serializedObject.FindProperty ("tileOffset");
    
        dropToTerrain_SP = serializedObject.FindProperty ("dropToTerrain");
		terrainSeekDist_SP = serializedObject.FindProperty ("terrainSeekDist");
		terrainLayer_SP = serializedObject.FindProperty ("terrainLayer");
		terrainOffset_SP = serializedObject.FindProperty ("terrainOffset");
		
		//updateType_SP = serializedObject.FindProperty ("updateType");
		
		objFile_SP = serializedObject.FindProperty ("objFile");
    }
	
	function OnInspectorGUI()
	{
		serializedObject.Update ();
		
		EditorGUIUtility.LookLikeInspector ();
		
		DrawDefaultInspector ();
		
		//remaking markers and updating if any marker is missing
		for (var m:int=0; m<target.markers.length; m++) if (!target.markers[m]) { target.UpdateNow(); break; }

		EditorGUILayout.PropertyField (markerSize_SP, new GUIContent("Marker Size", "Size of markers mesh cones"));
		//EditorGUILayout.PropertyField (closed_SP, new GUIContent("Closed"));
		EditorGUILayout.PropertyField (equalize_SP, new GUIContent("Equalize"));
		//EditorGUILayout.PropertyField (updateType_SP, new GUIContent("Update Type", "Manual updates only on script start. EditorSelected updates in editor only if object or marker seleced. EditorAlways updates in editor even if object is not selected. Playmode updates always in editor an playmode."));
		
		target.showMeshes = EditorGUILayout.Foldout(target.showMeshes, "Meshes");
		if (target.showMeshes)
		{
			EditorGUILayout.PropertyField (initialRenderMesh_SP, new GUIContent("\t Initial Render Mesh"));
			EditorGUILayout.PropertyField (initialCollisionMesh_SP, new GUIContent("\t Initial Collision Mesh"));
			EditorGUILayout.PropertyField (renderMesh_SP, new GUIContent("\t Render Mesh"));
			EditorGUILayout.PropertyField (collisionMesh_SP, new GUIContent("\t Collision Mesh"));
		}
		
		target.showTiles = EditorGUILayout.Foldout(target.showTiles, "Tiles");
		if (target.showTiles)
		{
			EditorGUILayout.PropertyField (tiles_SP, new GUIContent("\t Tile Count", "Mesh geometry repeats itself N times"));
			EditorGUILayout.PropertyField (tileOffset_SP, new GUIContent("\t Tile Offset", "Distance between tiles in Z axis"));

			var rect : Rect = GUILayoutUtility.GetRect (10, 18, "TextField");
			rect.x += 30; rect.width -= 60;
			
			if(GUI.Button(rect, "Reset Tile Offset"))  
			{
				var targetAxis : SplineBendAxis = target.axis;
				if (!!target.initialRenderMesh) 
				{
					switch (targetAxis) 
					{
						case SplineBendAxis.z: target.tileOffset = target.initialRenderMesh.bounds.size.z; break;
						case SplineBendAxis.y: target.tileOffset = target.initialRenderMesh.bounds.size.y; break;
						case SplineBendAxis.x: target.tileOffset = target.initialRenderMesh.bounds.size.x; break;
					}
				}
				
				else if (!!target.initialCollisionMesh) 
				{
					switch (targetAxis) 
					{
						case SplineBendAxis.z: target.tileOffset = target.initialCollisionMesh.bounds.size.z; break;
						case SplineBendAxis.y: target.tileOffset = target.initialCollisionMesh.bounds.size.y; break;
						case SplineBendAxis.x: target.tileOffset = target.initialCollisionMesh.bounds.size.x; break;
					}
				}
			}
		}
		
		target.showTerrain = EditorGUILayout.Foldout(target.showTerrain, "Drop to Terrain");
		if (target.showTerrain)
		{
			EditorGUILayout.PropertyField (dropToTerrain_SP, new GUIContent("\t Drop", "Places mesh at the surface of terrain or other collision mesh"));
			EditorGUILayout.PropertyField (terrainSeekDist_SP, new GUIContent("\t Seek Distance", "Seeks for terrain within this Y distance"));
			EditorGUILayout.PropertyField (terrainLayer_SP, new GUIContent("\t Terrain Layer", "Layer of the terrain object"));
			EditorGUILayout.PropertyField (terrainOffset_SP, new GUIContent("\t Height Offset", "Raises (or lowers) mesh above terrain"));
		}
		
		//target.showUpdate = EditorGUILayout.Foldout(target.showUpdate, "Update");
		//if (target.showUpdate)
		//{
			//if(GUILayout.Button("Update Now")) target.UpdateNow();
		//}
		
		target.showExport = EditorGUILayout.Foldout(target.showExport, "Export");
		if (target.showExport)
		{
			rect = GUILayoutUtility.GetRect (10, 18, "TextField");
			rect.x += 30; rect.width -= 30;
			if (GUI.Button(rect, "Export To Obj")) { target.ForceUpdate(); ExportToObj(); }
			
			rect = GUILayoutUtility.GetRect (10, 18, "TextField");
			rect.x += 30; rect.width -= 30;
			if (GUI.Button(rect, "Export And Assign")) 
			{
				target.ForceUpdate();
				var localPath : String = ExportToObj();
				var asset : Transform = AssetDatabase.LoadAssetAtPath(localPath, typeof(Transform));
				if (!asset) { Debug.Log("Could not load exported asset. Please make sure it was exported inside 'Assets' folder."); return; }
				
				target.enabled = false;
				
				var renderTfm : Transform = asset.Find(target.transform.name + "_render");
				if (!!renderTfm)
				{ 
					var targetFilter : MeshFilter = target.GetComponent(MeshFilter);
					if (!!targetFilter) targetFilter.mesh = renderTfm.GetComponent(MeshFilter).sharedMesh;
				}
				
				var collisionTfm : Transform = asset.Find(target.transform.name + "_collision");
				if (!!collisionTfm)
				{ 
					var targetCollider : MeshCollider = target.GetComponent(MeshCollider);
					if (!!targetCollider) targetCollider.sharedMesh = collisionTfm.GetComponent(MeshFilter).sharedMesh;
				}
			}
			
			//EditorGUILayout.PropertyField (objFile_SP, new GUIContent("\t Object file (.obj):"));
		}
		
		serializedObject.ApplyModifiedProperties ();
		
		//updating
		if (GUI.changed)
		{
			if (target.dropToTerrain && Tools.pivotMode == PivotMode.Center) Tools.pivotMode = PivotMode.Pivot;
			target.ForceUpdate();
		}
	}
	
	
	function OnSceneGUI() { DrawMarkers(target); }
	
	
	function ExportToString (mesh:Mesh, vCount:int, name:String)
	{
		var text = new System.Text.StringBuilder();
        
        for(var v : Vector3 in mesh.vertices) { text.Append("v " + (-v.x) + " " + v.y + " " + v.z); text.AppendLine(); }
		for(var v : Vector3 in mesh.normals) { text.Append("vn " + v.x + " " + v.y + " " + v.z); text.AppendLine(); }
		for(var v : Vector3 in mesh.uv) { text.Append("vt " + v.x + " " + v.y + " " + v.z); text.AppendLine(); }
        
        text.AppendLine();
        
        text.Append("g ").Append(target.transform.name + name); text.AppendLine();
        
        text.Append("usemtl unnamed"); text.AppendLine();
        text.Append("usemap unnamed"); text.AppendLine();
        for (var i=0;i<mesh.triangles.length;i+=3) 
		{
			text.Append(String.Format("f {2}/{2}/{2} {1}/{1}/{1} {0}/{0}/{0}\n", mesh.triangles[i]+vCount, mesh.triangles[i+1]+vCount, mesh.triangles[i+2]+vCount));
			text.AppendLine();
		}
		
		return text;
	}
	
	function ExportToObj () : String //returns local path of exported asset
	{
		var path : String = EditorUtility.SaveFilePanel("Save To Obj","Assets", target.transform.name + ".obj", "obj");	
		if (path.length == 0) return;
		ExportToObj(path);
				
		var localPath : String = path.Replace(Application.dataPath, "Assets");	
		AssetDatabase.ImportAsset(localPath, ImportAssetOptions.Default);		
		return localPath;
	}
	
	function ExportToObj (path:String)
	{
		var text = new System.Text.StringBuilder();
		var currentVertCount : int = 1;

		//exporting render mesh
		var renderMesh : Mesh;
		var filter : MeshFilter = target.GetComponent(MeshFilter);
		if (!!filter && !!filter.sharedMesh) renderMesh = filter.sharedMesh;
		
		if (!!renderMesh) 
		{
			text.Append( ExportToString(renderMesh, currentVertCount, "_render") );
			text.AppendLine();
			currentVertCount += renderMesh.vertices.length;
		}
		
		//exporting collision mesh
		var collisionMesh : Mesh;
		var collider : MeshCollider = target.GetComponent(MeshCollider);
		if (!!collider && !!collider.sharedMesh) collisionMesh = collider.sharedMesh;
		
		if (!!collisionMesh) 
		{
			text.Append( ExportToString(collisionMesh, currentVertCount, "_collision") );
			text.AppendLine();
			currentVertCount += collisionMesh.vertices.length;
		}
		
		//writing exported data
		//var sw = new System.IO.StreamWriter(path);
		//sw.WriteLine(text);
		//sw.Close();
		System.IO.File.WriteAllText(path, text.ToString());
	}
	
	static function DrawMarkers(splineBend:SplineBend) 
	{
	    //adding markers
		if (Event.current.type == EventType.MouseDown &&
			Event.current.button == 1 &&
			Event.current.control)
		{
			var camRay : Ray = Camera.current.ScreenPointToRay (Vector2(Event.current.mousePosition.x, Camera.current.pixelHeight-Event.current.mousePosition.y));
			splineBend.AddMarker(camRay);
		}
		
		//displaing markers
		Handles.matrix = splineBend.transform.localToWorldMatrix;
		for (m=0;m<splineBend.markers.length;m++)
		{
			Handles.color = Color(0.5,0,0,1);

			//setting node type
			var displayType = Handles.CubeCap;
			switch (splineBend.markers[m].type)
			{
				case 0: displayType = Handles.SphereCap; break;
				case 1: displayType = Handles.ConeCap; break;
			}

			//displaing nodes
			if (Handles.Button(splineBend.markers[m].position,
                    Quaternion.LookRotation(splineBend.markers[m].nextHandle-splineBend.markers[m].prewHandle, Vector3.up), //TODO: Vector3.up can cause bug when using Y-axis
                    splineBend.markerSize,
                    splineBend.markerSize*0.8,
                    displayType))
                    	Selection.activeTransform = splineBend.markers[m].transform;
			
			//drawing beizer
			if (m==splineBend.markers.length-1) continue;
			var subPoints : Vector3[] = splineBend.markers[m].subPoints;
			Handles.DrawPolyLine(subPoints);
		}
	}
}