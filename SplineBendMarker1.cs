using UnityEngine;
using System.Collections;

public class SplineBendMarker1 : MonoBehaviour
{
    public SplineBend1 splineScript;
    private int num;

    public enum MarkerType { Smooth = 0, Transform = 1, Beizer = 2, BeizerCorner = 3, Corner = 4 }
    public MarkerType type;

    //var prewHandleTransform : Transform;
    //var nextHandleTransform : Transform;
    [HideInInspector]
    public Vector3 position;
    [HideInInspector]
    public Vector3 up;

    [HideInInspector]
    public Vector3 prewHandle; //in marker local coords
    [HideInInspector]
    public Vector3 nextHandle;

    //var prewHandleLength : float;
    //var nextHandleLength : float;

    [HideInInspector]
    public float dist; //distance from the first marker
    [HideInInspector]
    public float percent; //marker pos in a whole spline from 0 to 1


    [HideInInspector]
    public Vector3[] subPoints = new Vector3[10]; //beizer points from this marker to the next one
    [HideInInspector]
    public float[] subPointPercents = new float[10];
    [HideInInspector]
    public float[] subPointFactors = new float[10];
    [HideInInspector]
    public float[] subPointMustPercents = new float[10];

    public bool expandWithScale;

    [HideInInspector]
    public Vector3 oldPos;
    [HideInInspector]
    public Vector3 oldScale;
    [HideInInspector]
    public Quaternion oldRot;

    /*
    var subPoints : Vector3[] = new Vector3[3]; //beizer points from this marker to the next one
    var subPointPercents : float[] = new float[3];
    var subPointFactors : float[] = new float[3];
    var subPointMustPercents : float[] = new float[3];
    */

    public void Init(SplineBend1 script, int mnum) //called from SplineBend
    {
        splineScript = script; num = mnum;
        up = transform.up;
        position = script.transform.InverseTransformPoint(transform.position); //localPosition
                                                                               //position = script.transform.localPosition;
                                                                               //marker position in script tfm coordsys
                                                                               //even if marker not a script tfm child

        //finding next and prew markers
        SplineBendMarker1 nextMarker = null;
        SplineBendMarker1 prewMarker = null;
        if (num > 0) prewMarker = splineScript.markers[num - 1];
        if (num < splineScript.markers.Length - 1) nextMarker = splineScript.markers[num + 1];

        //calculating marker distance
        if (prewMarker != null) dist = prewMarker.dist + SplineBend1.GetBeizerLength(prewMarker, this);
        else dist = 0;

        //amendments in first (and last) marker prew-next if spline is closed
        if (splineScript.closed && num == splineScript.markers.Length - 1)
        {
            nextMarker = splineScript.markers[splineScript.markers.Length - 2];
            nextMarker = splineScript.markers[1];
        }

        //creating sub-points
        if (!!nextMarker)
        {
            if (subPoints == null) subPoints = new Vector3[10];
            float percentStep = 1f / (subPoints.Length - 1);
            for (int p = 0; p < subPoints.Length; p++)
                subPoints[p] = splineScript.AlignPoint(this, nextMarker, percentStep * p, new Vector3(0, 0, 0));

            //percent data
            float totalDist = 0;
            subPointPercents[0] = 0;
            float mustStep = 1f / (subPoints.Length - 1);
            for (int p = 1; p < subPoints.Length; p++)
            {
                subPointPercents[p] = totalDist + (subPoints[p - 1] - subPoints[p]).magnitude;
                totalDist = subPointPercents[p];

                subPointMustPercents[p] = mustStep * p;
            }
            for (var p = 1; p < subPoints.Length; p++) subPointPercents[p] = subPointPercents[p] / totalDist;
            for (var p = 0; p < subPoints.Length - 1; p++) subPointFactors[p] = mustStep / (subPointPercents[p + 1] - subPointPercents[p]);
        }

        //finding next marker position - we will use it in switch below
        Vector3 nextMarkerPosition = new Vector3(0, 0, 0);
        if (!!nextMarker) nextMarkerPosition = script.transform.InverseTransformPoint(nextMarker.transform.position);
        //and prew marker pos already defined

        switch (type)
        {
            case MarkerType.Smooth:

                if (!nextMarker) { prewHandle = (prewMarker.position - position) * 0.333f; nextHandle = -prewHandle * 0.99f; }
                else if (!prewMarker) { nextHandle = (nextMarkerPosition - position) * 0.333f; prewHandle = -nextHandle * 0.99f; }
                else
                {
                    nextHandle = Vector3.Slerp(-(prewMarker.position - position) * 0.333f, (nextMarkerPosition - position) * 0.333f, 0.5f);
                    prewHandle = Vector3.Slerp((prewMarker.position - position) * 0.333f, -(nextMarkerPosition - position) * 0.333f, 0.5f);
                }
                break;

            case MarkerType.Transform:
                if (!!prewMarker)
                {
                    float prewDist = (position - prewMarker.position).magnitude;
                    prewHandle = -transform.forward * transform.localScale.z * prewDist * 0.4f;
                }
                if (!!nextMarker)
                {
                    float nextDist = (position - nextMarkerPosition).magnitude;
                    nextHandle = transform.forward * transform.localScale.z * nextDist * 0.4f;
                }
                break;

            case MarkerType.Corner:
                if (!!prewMarker) prewHandle = (prewMarker.position - position) * 0.333f; else prewHandle = new Vector3(0, 0, 0);
                if (!!nextMarker) nextHandle = (nextMarkerPosition - position) * 0.333f; else nextHandle = new Vector3(0, 0, 0);
                break;
        }

        //avoiding zero-length handle vectors
        //if (nextHandle.sqrMagnitude==0 && prewHandle.sqrMagnitude==0) { nextHandle=Vector3(0.001,0,0); prewHandle=Vector3(-0.001,0,0); }
        if ((nextHandle - prewHandle).sqrMagnitude < 0.01) nextHandle += new Vector3(0.001f, 0, 0);
    }









}
