// Increase/decrease a value just by moving the Scale slider Handle


@CustomEditor (SplineBendMarker)
class SplineBendMarkerEditor extends Editor 
{
	function OnInspectorGUI()
	{
		//EditorGUIUtility.LookLikeInspector ();
		DrawDefaultInspector ();
		
		//remaking markers and updating if any marker is missing
		if (!target.splineScript) return;
		for (var m:int=0; m<target.splineScript.markers.length; m++) if (!target.splineScript.markers[m]) { changed=true; break; }
		
		if (GUI.changed) target.splineScript.ForceUpdate();
	}

    static var triVerts : Vector3[] = [Vector3(1,0,0), Vector3(0,1,0), Vector3(0,0,1)];
    static var triFaces : int[] = [0,1,2]; 
    
	var changed : boolean = false;
    var wasChange : boolean = false;
    
    var collisionUpdated : boolean = false;
    
    var mousePressed : boolean = false;
    var mouseWasPressed : boolean = false;
    
    function OnSceneGUI () 
    {
    	if (!target.splineScript) return;
    	Undo.SetSnapshotTarget(target, "SplineBend");
    	
    	SplineBendEditor.DrawMarkers(target.splineScript);
		
		
		//display marker itself
		Handles.color = Color(1,0,0,1);
		var diaplayRotation : Quaternion = Quaternion.LookRotation(target.nextHandle-target.prewHandle, Vector3.up);
		switch (target.type)
		{
			case 0: Handles.SphereCap (0, target.position, diaplayRotation, target.splineScript.markerSize*1.2); break;
			case 1: Handles.ConeCap (0, target.position, diaplayRotation, target.splineScript.markerSize*1.2); break;
			default: Handles.CubeCap (0, target.position, diaplayRotation, target.splineScript.markerSize*1.2);
		}

    	//drawing tangents
    	//Handles.color = Color(0.25,0,0,1);
    	Handles.DrawLine(target.position, target.position+target.prewHandle);
    	Handles.DrawLine(target.position, target.position+target.nextHandle);
		
		
    	//displaing handles
    	if (target.type == 2 || target.type == 3)
    	{
	    	var prewHandle : Vector3 = Handles.PositionHandle (target.prewHandle+target.position, Quaternion.identity)-target.position;
	    	var nextHandle : Vector3 = Handles.PositionHandle (target.nextHandle+target.position, Quaternion.identity)-target.position;
	    	
	    	//finding which of handles changed more
	    	var prewHandleDelta : float = (prewHandle - target.prewHandle).sqrMagnitude;
	    	var nextHandleDelta : float = (nextHandle - target.nextHandle).sqrMagnitude;
	
	    	if (prewHandleDelta > 0.000001 || nextHandleDelta > 0.000001) 
	    	{
		    	if (prewHandleDelta > nextHandleDelta)
		    	{
		    		target.prewHandle = prewHandle;
					if (target.type == 2)
		    			target.nextHandle = -prewHandle.normalized * target.nextHandle.magnitude;
		    	}
		    	
		    	else //(prewHandleDelta < nextHandleDelta)
		    	{
		    		target.nextHandle = nextHandle;
					if (target.type == 2)
		    			target.prewHandle = -nextHandle.normalized * target.prewHandle.magnitude;
		    	}
	    	
	    		changed = true;
	    	}
    	}

		if (Event.current.type == EventType.MouseDown) mousePressed = true;
		if (Event.current.type == EventType.MouseUp) mousePressed = false;
		

		if (changed 
			|| target.transform.position != target.oldPos
			|| target.transform.localScale != target.oldScale
			|| target.transform.rotation != target.oldRot) 
		{	
			//updating without collision
			if (Event.current.type == EventType.Repaint) 
			{
				target.splineScript.ForceUpdate(false);
			
				target.oldPos = target.transform.position;
				target.oldScale = target.transform.localScale;
				target.oldRot = target.transform.rotation;
			
				changed = false;
				wasChange = true;
			}
		}
		else if (wasChange && Event.current.type == EventType.MouseUp) { target.splineScript.ForceUpdate(true); wasChange = false; }
		
		
		
    }
}