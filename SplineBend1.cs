using UnityEngine;
using System.Collections;
[ExecuteInEditMode]
public class SplineBend1 : MonoBehaviour
{

    public SplineBendMarker1[] markers;

    [HideInInspector]
    public bool showMeshes = false;
    [HideInInspector]
    public bool showTiles = false;
    [HideInInspector]
    public bool showTerrain = false;
    [HideInInspector]
    public bool showUpdate = false;
    [HideInInspector]
    public bool showExport = false;

    [HideInInspector]
    public Mesh initialRenderMesh;
    [HideInInspector]
    public Mesh renderMesh;
    [HideInInspector]
    public Mesh initialCollisionMesh;
    [HideInInspector]
    public Mesh collisionMesh;

    [HideInInspector]
    public int tiles = 1;
    [HideInInspector]
    public float tileOffset = -1;
    [HideInInspector]
    private int oldTiles = 1;
    //@HideInInspector private var oldTileOffset : float = -1;

    [HideInInspector]
    public bool dropToTerrain = false;
    [HideInInspector]
    public float terrainSeekDist = 1000;
    [HideInInspector]
    public int terrainLayer = 0;
    [HideInInspector]
    public float terrainOffset = 0;

    [HideInInspector]
    public bool equalize = true;
    [HideInInspector]
    public bool closed;
    [HideInInspector]
    public bool wasClosed;
    [HideInInspector]
    public float markerSize = 1;

    [HideInInspector]
    public bool displayRolloutOpen = false;
    [HideInInspector]
    public bool settingsRolloutOpen = false;
    [HideInInspector]
    public bool terrainRolloutOpen = false;

    public enum SplineBendAxis { x, y, z }
    public SplineBendAxis axis = SplineBendAxis.z;
    private Vector3 axisVector;

    //@HideInInspector var startCap : Transform;
    //@HideInInspector var endCap : Transform;

    //@HideInInspector var updateType : UpdateType = UpdateType.editorIfSelected;

    Transform objFile;

    public static Vector3 GetBeizerPoint(Vector3 p0, Vector3 p1, Vector3 p2, Vector3 p3, float t)
    {
        float it = 1 - t;
        return it * it * it * p0 + 3 * t * it * it * p1 + 3 * t * t * it * p2 + t * t * t * p3;
    }

    public static float GetBeizerLength(Vector3 p0, Vector3 p1, Vector3 p2, Vector3 p3)
    {
        float Length = 0;
        Vector3 oldPoint = p0;
        Vector3 curPoint;
        for (float i = 0; i < 1.01f; i += 0.1f)
        {
            curPoint = GetBeizerPoint(p0, p1, p2, p3, i);
            Length += (oldPoint - curPoint).magnitude;
            oldPoint = curPoint;
        }
        return Length;

        //sqrt(a*x^4+b*x^3+c*x^2+d*x+e)
        //sqrt(1/5a + 1/4b + 1/2d + 1/3c + e)
    }
    public static float GetBeizerLength(SplineBendMarker1 marker1, SplineBendMarker1 marker2)
    {
        float dist = (marker2.position - marker1.position).magnitude * 0.5f;
        return GetBeizerLength(
                marker1.position,
                marker1.nextHandle + marker1.position,
                marker2.prewHandle + marker2.position,
                marker2.position);
    }


    public Vector3 AlignPoint(SplineBendMarker1 marker1, SplineBendMarker1 marker2, float percent, Vector3 coords)
    {
        //var dist : float = marker1.dist + marker1.distAdjustRight*coords.z + marker1.distAdjustUp*coords.y;
        float dist = (marker2.position - marker1.position).magnitude * 0.5f;

        //picking two points on a beizer curve
        Vector3 pointBefore = GetBeizerPoint(
                marker1.position,
                marker1.nextHandle + marker1.position,
                marker2.prewHandle + marker2.position,
                marker2.position,
                Mathf.Max(0, percent - 0.01f));

        Vector3 pointAfter = GetBeizerPoint(
                marker1.position,
                marker1.nextHandle + marker1.position,
                marker2.prewHandle + marker2.position,
                marker2.position,
                Mathf.Min(1, percent + 0.01f));

        //getting main curve point and its tangent
        //var point : Vector3 = (pointAfter + pointBefore)*0.5; //inaccurate
        Vector3 point = GetBeizerPoint(
                marker1.position,
                marker1.nextHandle + marker1.position,
                marker2.prewHandle + marker2.position,
                marker2.position,
                percent);
        Vector3 tangent = pointBefore - pointAfter;

        //getting right and up vectors
        Vector3 orientation = Vector3.Slerp(marker1.up, marker2.up, percent);
        Vector3 perpRight = Vector3.Cross(tangent, orientation).normalized;
        Vector3 perpUp = Vector3.Cross(perpRight, tangent).normalized;

        //calculating marker-based scale
        Vector3 scale = new Vector3(1, 1, 1);
        if (marker1.expandWithScale || marker2.expandWithScale)
        {
            float sp1 = percent * percent;
            float sp2 = 1 - (1 - percent) * (1 - percent);
            float sp = sp2 * percent + sp1 * (1 - percent);

            scale.x = marker1.transform.localScale.x * (1 - sp) + marker2.transform.localScale.x * sp;
            scale.y = marker1.transform.localScale.y * (1 - sp) + marker2.transform.localScale.y * sp;
        }

        //returning result
        return point +
            perpRight * coords.x * scale.x +
            perpUp * coords.y * scale.y;
    }

    public void BuildMesh(Mesh mesh, Mesh initialMesh, int num, float offset)
    {
        int v = 0;

        //get initial arrays
        Vector3[] vertices = initialMesh.vertices;
        Vector2[] uvs = initialMesh.uv;
        Vector2[] uv2 = initialMesh.uv2;
        int[] tris = initialMesh.triangles;
        Vector4[] tangents = initialMesh.tangents;

        //changing axis

        //setting tiled arrays
        Vector3[] tiledVerts = new Vector3[vertices.Length * num];
        Vector2[] tiledUvs = new Vector2[vertices.Length * num];
        Vector2[] tiledUv2 = new Vector2[vertices.Length * num];
        Vector4[] tiledTangents = new Vector4[vertices.Length * num];
        bool hasSecondUv = uv2.Length > 0;
        for (int i = 0; i < num; i++)
            for (v = 0; v < vertices.Length; v++)
            {
                tiledVerts[i * vertices.Length + v] = vertices[v];// + Vector3(0, 0, 1)*tileOffset*i; //we'll do it in Align

                tiledUvs[i * vertices.Length + v] = uvs[v];
                //if (hasSecondUv) tiledUv2[i*vertices.Length + v] = uv2[v];
                tiledTangents[i * vertices.Length + v] = tangents[v];
            }
        int[] tiledTris = new int[tris.Length * num];
        for (int i = 0; i < num; i++)
            for (v = 0; v < tris.Length; v++)
                tiledTris[i * tris.Length + v] = tris[v] + (vertices.Length * i);

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

    void RebuildMeshes() //on changing tile count, actually
    {
        if (!!renderMesh)
        {
            MeshFilter fil = GetComponent<MeshFilter>();
            if (!fil) return;
            renderMesh.Clear();
            BuildMesh(renderMesh, initialRenderMesh, tiles, tileOffset);
            fil.sharedMesh = renderMesh;
            renderMesh.RecalculateBounds();
            renderMesh.RecalculateNormals();
        }
        if (!!collisionMesh)
        {
            MeshCollider col = GetComponent<MeshCollider>();
            if (!col) return;
            collisionMesh.Clear();
            BuildMesh(collisionMesh, initialCollisionMesh, tiles, tileOffset);
            col.sharedMesh = null;
            col.sharedMesh = collisionMesh;
            collisionMesh.RecalculateBounds();
            collisionMesh.RecalculateNormals();
        }
    }

    void Align(Mesh mesh, Mesh initialMesh)
    {
        //generating 'straight' mesh array. Do not use sourceVerts anymore
        Vector3[] verts = new Vector3[mesh.vertexCount];
        var sourceVerts = initialMesh.vertices;
        for (var i = 0; i < tiles; i++)
            for (var v = 0; v < sourceVerts.Length; v++)
            {
                var nv = i * sourceVerts.Length + v;
                verts[nv] = sourceVerts[v] + axisVector * tileOffset * i;
                if (axis == SplineBendAxis.x) verts[nv] = new Vector3(-verts[nv].z, verts[nv].y, verts[nv].x);
                else if (axis == SplineBendAxis.y) verts[nv] = new Vector3(-verts[nv].x, verts[nv].z, verts[nv].y);
            }

        //reseting bounds size
        float boundsSize;
        var minPoint = Mathf.Infinity;
        var maxPoint = Mathf.NegativeInfinity;
        for (var v = 0; v < verts.Length; v++)
        {
            minPoint = Mathf.Min(minPoint, verts[v].z);
            maxPoint = Mathf.Max(maxPoint, verts[v].z);
        }
        boundsSize = maxPoint - minPoint;

        //placing verts
        for (var v = 0; v < verts.Length; v++)
        {
            //calculating percent of each mesh vert
            var percent = (verts[v].z - minPoint) / boundsSize;
            percent = Mathf.Clamp01(percent);
            if (Mathf.Approximately(boundsSize, 0)) percent = 0; //devision by zero

            //calculating marker num
            int markerNum = 0;
            for (var m = 1; m < markers.Length; m++)
                if (markers[m].percent >= percent) { markerNum = m - 1; break; } //note that markerNum cannot be the last marker

            if (closed && percent < markers[1].percent) markerNum = 0;

            //calculating relative percent
            var relativePercent = (percent - markers[markerNum].percent) / (markers[markerNum + 1].percent - markers[markerNum].percent);
            if (closed && percent < markers[1].percent) relativePercent = percent / markers[1].percent;

            //equalizing
            if (equalize)
            {
                int sp = 0; //prew subpoint
                float distFromSubpoint;
                for (var s = 1; s < markers[markerNum].subPoints.Length; s++)
                    if (markers[markerNum].subPointPercents[s] >= relativePercent) { sp = s - 1; break; }
                distFromSubpoint = (relativePercent - markers[markerNum].subPointPercents[sp]) * markers[markerNum].subPointFactors[sp];
                relativePercent = markers[markerNum].subPointMustPercents[sp] + distFromSubpoint;
            }

            //setting
            verts[v] = AlignPoint(markers[markerNum], markers[markerNum + 1], relativePercent, verts[v]);
        }

        mesh.vertices = verts;
    }


    void FallToTerrain(Mesh mesh, Mesh initialMesh, float seekDist, int layer, float offset)
    {
        Vector3[] verts = mesh.vertices;

        //generating array of original vert heights
        float[] heights = new float[mesh.vertexCount];
        Vector3[] sourceVerts = initialMesh.vertices; //Will not use sourceVerts anymore
        switch (axis)
        {
            case SplineBendAxis.z:
            case SplineBendAxis.x:
                for (var i = 0; i < tiles; i++)
                    for (var v = 0; v < sourceVerts.Length; v++)
                        heights[i * sourceVerts.Length + v] = sourceVerts[v].y;
                break;
            case SplineBendAxis.y:
                for (var i = 0; i < tiles; i++)
                    for (var v = 0; v < sourceVerts.Length; v++)
                        heights[i * sourceVerts.Length + v] = sourceVerts[v].z;
                break;
        }

        //flooring verts
        var oldLayer = gameObject.layer;
        gameObject.layer = 1 << 2;
        RaycastHit hit;
        for (var v = 0; v < verts.Length; v++)
        {
            Vector3 globalVert = transform.TransformPoint(verts[v]);
            globalVert.y = transform.position.y;
            if (Physics.Raycast(globalVert + new Vector3(0, seekDist * 0.5f, 0), -Vector3.up, out hit, seekDist, 1 << layer))
                verts[v].y = heights[v] + transform.InverseTransformPoint(hit.point).y + offset;
        }
        gameObject.layer = oldLayer;

        mesh.vertices = verts;
    }

    void ResetMarkers() { ResetMarkers(markers.Length); }
    void ResetMarkers(int count)
    {
        markers = new SplineBendMarker1[count];

        //determining what mesh's bb shall be used
        Mesh initialMesh;
        if (!!initialRenderMesh) initialMesh = initialRenderMesh;
        else if (!!initialCollisionMesh) initialMesh = initialCollisionMesh;

        //getting mesh bounds
        Bounds bounds = new Bounds();
        bool boundsFound = false;
        if (!!initialRenderMesh) { bounds = initialRenderMesh.bounds; boundsFound = true; }
        else if (!!initialCollisionMesh) { bounds = initialCollisionMesh.bounds; boundsFound = true; }

        if (!boundsFound && !!GetComponent(typeof(MeshFilter))) { bounds = GetComponent<MeshFilter>().sharedMesh.bounds; boundsFound = true; }
        if (!boundsFound && !!GetComponent(typeof(MeshCollider))) { bounds = GetComponent<MeshCollider>().sharedMesh.bounds; boundsFound = true; }
        if (!boundsFound) bounds = new Bounds(Vector3.zero, new Vector3(1, 1, 1));

        var placementStart = bounds.min.z;
        var placementStep = bounds.size.z / (count - 1);

        for (var m = 0; m < count; m++)
        {
            var markerTfm = new GameObject("Marker" + m).transform;
            markerTfm.parent = transform;
            markerTfm.localPosition = new Vector3(0, 0, placementStart + placementStep * m);
            markers[m] = markerTfm.gameObject.AddComponent<SplineBendMarker1>();
        }
    }

    public void AddMarker(Vector3 coords)
    {
        //finding closest marker
        int prewMarkerNum = 0; //marker after which new marker will be added
        float distSq = Mathf.Infinity;
        float curDistSq;
        for (var m = 0; m < markers.Length; m++)
        {
            curDistSq = (markers[m].position - coords).sqrMagnitude;
            if (curDistSq < distSq) { prewMarkerNum = m; distSq = curDistSq; }
        }

        AddMarker(prewMarkerNum, coords);
    }

    public void AddMarker(Ray camRay) //adding marker closest to the given ray
    {
        //finding marker
        float closestDist = Mathf.Infinity;
        //var currentDist : float;
        int closestMarker = 0;
        int closestSubpoint = 0;

        for (int m = 0; m < markers.Length; m++)
        {
            var marker = markers[m];

            for (int s = 0; s < marker.subPoints.Length; s++)
            {
                //finding shortest distance between camRay and point
                Vector3 subPointPos = transform.TransformPoint(marker.subPoints[s]);
                float rayLength = Vector3.Dot(camRay.direction, (subPointPos - camRay.origin).normalized)
                    * (camRay.origin - subPointPos).magnitude;
                var currentDist = (camRay.origin + camRay.direction * rayLength - subPointPos).magnitude;

                if (currentDist < closestDist)
                {
                    closestMarker = m;
                    closestSubpoint = s;
                    closestDist = currentDist;
                    //closestPointPos = transform.TransformPoint(marker.subPoints[s]);
                }
            }
        }

        Vector3 pointPos = transform.TransformPoint(markers[closestMarker].subPoints[closestSubpoint]);
        float dist = (camRay.origin - pointPos).magnitude;

        AddMarker(closestMarker, camRay.origin + camRay.direction * dist);

        UpdateNow(); UpdateNow();
    }

    void AddMarker(int prewMarkerNum, Vector3 coords)
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
        SplineBendMarker1[] newMarkers = new SplineBendMarker1[markers.Length + 1];
        for (int m = 0; m < markers.Length; m++)
        {
            if (m <= prewMarkerNum) newMarkers[m] = markers[m];
            else newMarkers[m + 1] = markers[m];
        }

        //creating gameobject
        Transform markerTfm = new GameObject("Marker" + (prewMarkerNum + 1)).transform;
        markerTfm.parent = transform;
        markerTfm.position = coords;
        newMarkers[prewMarkerNum + 1] = markerTfm.gameObject.AddComponent<SplineBendMarker1>();

        markers = newMarkers;
    }

    void RefreshMarkers() //re-creates markers array ignoring non-existent ones
    {
        var newCount = 0;

        for (var m = 0; m < markers.Length; m++)
            if (!!markers[m]) newCount++;

        var newMarkers = new SplineBendMarker1[newCount];

        var counter = 0;
        for (var m = 0; m < markers.Length; m++)
        {
            if (!markers[m]) continue;
            newMarkers[counter] = markers[m];
            counter++;
        }

        markers = newMarkers;
    }

    void RemoveMarker(int num)
    {
        //destroing game object
        DestroyImmediate(markers[num].gameObject);

        //re-creating markers array
        var newMarkers = new SplineBendMarker1[markers.Length - 1];
        for (var m = 0; m < markers.Length - 1; m++)
        {
            if (m < num) newMarkers[m] = markers[m];
            else newMarkers[m] = markers[m + 1];
        }

        markers = newMarkers;
    }

    void CloseMarkers()
    {
        if (closed || markers[0] == markers[markers.Length - 1]) return; //already closed

        var newMarkers = new SplineBendMarker1[markers.Length + 1];
        for (var m = 0; m < markers.Length; m++) newMarkers[m] = markers[m];
        markers = newMarkers;

        markers[markers.Length - 1] = markers[0];

        UpdateNow();

        closed = true;
    }

    void UnCloseMarkers()
    {
        if (!closed || markers[0] != markers[markers.Length - 1]) return; //already unclosed

        var newMarkers = new SplineBendMarker1[markers.Length - 1];
        for (var m = 0; m < markers.Length - 1; m++) newMarkers[m] = markers[m];
        markers = newMarkers;

        UpdateNow();

        closed = false;
    }


    void OnEnable()
    {
        //removing render and collision mehses to prevent using same mesh by many SplineBends
        renderMesh = null;
        collisionMesh = null;

        ForceUpdate();

        var f = GetComponent<MeshFilter>();
        var c = GetComponent<MeshCollider>();

        if (!!renderMesh && !!f) f.sharedMesh = renderMesh;
        if (!!collisionMesh && !!c) { c.sharedMesh = null; c.sharedMesh = collisionMesh; }
    }

    void OnDisable()
    {
        var f = GetComponent<MeshFilter>();
        var c = GetComponent<MeshCollider>();

        if (!!initialRenderMesh && !!f) f.sharedMesh = initialRenderMesh;
        if (!!initialCollisionMesh && !!c) { c.sharedMesh = null; c.sharedMesh = initialCollisionMesh; }
    }

    public void UpdateNow()
    {
        ForceUpdate(true);
    }
    public void ForceUpdate() { ForceUpdate(true); }
    public void ForceUpdate(bool refreshCollisionMesh)
    {
        var collider = GetComponent<MeshCollider>();
        var filter = GetComponent<MeshFilter>();

        //setting axis vector
        switch (axis)
        {
            case SplineBendAxis.x: axisVector = new Vector3(1, 0, 0); break;
            case SplineBendAxis.y: axisVector = new Vector3(0, 1, 0); break;
            case SplineBendAxis.z: axisVector = new Vector3(0, 0, 1); break;
        }

        //limiting tiles numbers
        if (!!initialRenderMesh) tiles = Mathf.Min(tiles, Mathf.FloorToInt(65000f / initialRenderMesh.vertices.Length));
        else if (!!initialCollisionMesh) tiles = Mathf.Min(tiles, Mathf.FloorToInt(65000f / initialCollisionMesh.vertices.Length));
        tiles = Mathf.Max(tiles, 1);

        //refreshing or recreating markers
        if (markers != null) ResetMarkers(2);
        for (var m = 0; m < markers.Length; m++)
            if (!markers[m]) RefreshMarkers();
        if (markers.Length < 2) ResetMarkers(2);

        //initializing markers, setting position, handles and distance
        for (var m = 0; m < markers.Length; m++) markers[m].Init(this, m);
        if (closed) markers[0].dist = markers[markers.Length - 2].dist + GetBeizerLength(markers[markers.Length - 2], markers[0]);

        //setting marker percents
        var totalDist = markers[markers.Length - 1].dist;
        if (closed) totalDist = markers[0].dist;
        for (var m = 0; m < markers.Length; m++) markers[m].percent = markers[m].dist / totalDist;

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
                renderMesh = Instantiate(initialRenderMesh);
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
                collisionMesh = Instantiate(initialCollisionMesh);
                collisionMesh.hideFlags = HideFlags.HideAndDontSave; //meshes must not save with a scene

                collider.sharedMesh = collisionMesh;
            }
        }


        //updating render mesh: rebuilding if needed, aligning, dropping
        if (!!renderMesh && !!initialRenderMesh && !!filter)
        {
            if (renderMesh.vertexCount != initialRenderMesh.vertexCount * tiles) BuildMesh(renderMesh, initialRenderMesh, tiles, 0);
            Align(renderMesh, initialRenderMesh);
            if (dropToTerrain) FallToTerrain(renderMesh, initialRenderMesh, terrainSeekDist, terrainLayer, terrainOffset);

            //refreshing
            renderMesh.RecalculateBounds();
            renderMesh.RecalculateNormals();
        }


        //updating collision mesh. The same
        if (!!collisionMesh && !!initialCollisionMesh && !!collider)
        {
            if (collisionMesh.vertexCount != initialCollisionMesh.vertexCount * tiles) BuildMesh(collisionMesh, initialCollisionMesh, tiles, 0);
            Align(collisionMesh, initialCollisionMesh);
            if (dropToTerrain) FallToTerrain(collisionMesh, initialCollisionMesh, terrainSeekDist, terrainLayer, terrainOffset);

            //refreshing
            if (refreshCollisionMesh && collider.sharedMesh == collisionMesh) //if refresh needed and collider mesh assigned to collider
            {
                collisionMesh.RecalculateBounds();
                collisionMesh.RecalculateNormals();
                collider.sharedMesh = null;
                collider.sharedMesh = collisionMesh;
            }
        }
    }

}
