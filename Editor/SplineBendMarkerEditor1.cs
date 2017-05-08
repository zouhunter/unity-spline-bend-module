using UnityEngine;
using System.Collections;
using UnityEditor;
[CustomEditor(typeof(SplineBendMarker1))]
public class SplineBendMarkerEditor1 :Editor {
    public override void OnInspectorGUI()
    {
        //EditorGUIUtility.LookLikeInspector ();
        DrawDefaultInspector();
        var target = (SplineBendMarker1)base.target;
        //remaking markers and updating if any marker is missing
        if (!target.splineScript) return;
        for (var m = 0; m < target.splineScript.markers.Length; m++) if (!target.splineScript.markers[m]) { changed = true; break; }

        if (GUI.changed) target.splineScript.ForceUpdate();
    }

    static Vector3[] triVerts = new Vector3[] { new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1) };
    static int[] triFaces  =new int[] { 0, 1, 2 }; 
    
	bool changed = false;
    bool wasChange  = false;

    bool collisionUpdated  = false;
    
    bool mousePressed  = false;
    bool mouseWasPressed  = false;
    
    void OnSceneGUI()
    {
        var target = (SplineBendMarker1)base.target;

        if (!target.splineScript) return;
        Undo.SetSnapshotTarget(target, "SplineBend");

        SplineBendEditor1.DrawMarkers(target.splineScript);


        //display marker itself
        Handles.color =new Color(1, 0, 0, 1);
        var diaplayRotation  = Quaternion.LookRotation(target.nextHandle - target.prewHandle, Vector3.up);
        switch ((int)target.type)
        {
            case 0: Handles.SphereCap(0, target.position, diaplayRotation, target.splineScript.markerSize * 1.2f); break;
            case 1: Handles.ConeCap(0, target.position, diaplayRotation, target.splineScript.markerSize * 1.2f); break;
            default: Handles.CubeCap(0, target.position, diaplayRotation, target.splineScript.markerSize * 1.2f); break;
        }

        //drawing tangents
        //Handles.color = Color(0.25,0,0,1);
        Handles.DrawLine(target.position, target.position + target.prewHandle);
        Handles.DrawLine(target.position, target.position + target.nextHandle);


        //displaing handles
        if ((int)target.type == 2 || (int)target.type == 3)
        {
            var prewHandle = Handles.PositionHandle(target.prewHandle + target.position, Quaternion.identity) - target.position;
            var nextHandle = Handles.PositionHandle(target.nextHandle + target.position, Quaternion.identity) - target.position;

            //finding which of handles changed more
            var prewHandleDelta  = (prewHandle - target.prewHandle).sqrMagnitude;
            var nextHandleDelta  = (nextHandle - target.nextHandle).sqrMagnitude;
                                       
            if (prewHandleDelta > 0.000001 || nextHandleDelta > 0.000001)
            {
                if (prewHandleDelta > nextHandleDelta)
                {
                    target.prewHandle = prewHandle;
                    if ((int)target.type == 2)
                        target.nextHandle = -prewHandle.normalized * target.nextHandle.magnitude;
                }

                else //(prewHandleDelta < nextHandleDelta)
                {
                    target.nextHandle = nextHandle;
                    if ((int)target.type == 2)
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
