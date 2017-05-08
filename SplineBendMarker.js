
var splineScript : SplineBend;
@HideInInspector var num : int;

enum MarkerType {Smooth=0, Transform=1, Beizer=2, BeizerCorner=3, Corner=4}
var type : MarkerType;

//var prewHandleTransform : Transform;
//var nextHandleTransform : Transform;

@HideInInspector var position : Vector3;
@HideInInspector var up : Vector3;

@HideInInspector var prewHandle : Vector3; //in marker local coords
@HideInInspector var nextHandle : Vector3;

//var prewHandleLength : float;
//var nextHandleLength : float;

@HideInInspector var dist : float; //distance from the first marker
@HideInInspector var percent : float; //marker pos in a whole spline from 0 to 1


@HideInInspector var subPoints : Vector3[] = new Vector3[10]; //beizer points from this marker to the next one
@HideInInspector var subPointPercents : float[] = new float[10];
@HideInInspector var subPointFactors : float[] = new float[10];
@HideInInspector var subPointMustPercents : float[] = new float[10];

var expandWithScale : boolean;

@HideInInspector var oldPos : Vector3;
@HideInInspector var oldScale : Vector3;
@HideInInspector var oldRot : Quaternion;

/*
var subPoints : Vector3[] = new Vector3[3]; //beizer points from this marker to the next one
var subPointPercents : float[] = new float[3];
var subPointFactors : float[] = new float[3];
var subPointMustPercents : float[] = new float[3];
*/

function Init (script:SplineBend, mnum:int) //called from SplineBend
{
	splineScript = script; num = mnum;
	up = transform.up;
	position = script.transform.InverseTransformPoint(transform.position); //localPosition
	//position = script.transform.localPosition;
	//marker position in script tfm coordsys
	//even if marker not a script tfm child
	
	//finding next and prew markers
	var nextMarker : SplineBendMarker;
	var prewMarker : SplineBendMarker;
	if (num>0) prewMarker = splineScript.markers[num-1];
	if (num<splineScript.markers.length-1) nextMarker = splineScript.markers[num+1];
	
	//calculating marker distance
	if (!!prewMarker) dist = prewMarker.dist + SplineBend.GetBeizerLength(prewMarker, this);
	else dist = 0;
	
	//amendments in first (and last) marker prew-next if spline is closed
	if (splineScript.closed && num==splineScript.markers.length-1)
	{
		nextMarker = splineScript.markers[splineScript.markers.length-2];
		nextMarker = splineScript.markers[1];
	}
	
	//creating sub-points
	if (!!nextMarker) 
	{
		if (!subPoints) subPoints = new Vector3[10];
		var percentStep : float = 1f/(subPoints.length-1);
		for (var p:int=0; p<subPoints.length; p++)
			subPoints[p] = splineScript.AlignPoint(this, nextMarker, percentStep*p, Vector3(0,0,0));
			
		//percent data
		var totalDist : float = 0;
		subPointPercents[0]  = 0;
		var mustStep : float = 1f / (subPoints.length-1);
		for (p=1; p<subPoints.length; p++) 
		{
			subPointPercents[p] = totalDist + (subPoints[p-1]-subPoints[p]).magnitude;
			totalDist = subPointPercents[p];
			
			subPointMustPercents[p] = mustStep*p;
		}
		for (p=1; p<subPoints.length; p++) subPointPercents[p] = subPointPercents[p] / totalDist;
		for (p=0; p<subPoints.length-1; p++) subPointFactors[p] = mustStep / (subPointPercents[p+1] - subPointPercents[p]) ;
	}
	
	//finding next marker position - we will use it in switch below
	var nextMarkerPosition : Vector3 = Vector3(0,0,0);
	if (!!nextMarker) nextMarkerPosition = script.transform.InverseTransformPoint(nextMarker.transform.position);
	//and prew marker pos already defined
	
	switch (type)
	{	
		case MarkerType.Smooth:
			
			if (!nextMarker) { prewHandle = (prewMarker.position - position)*0.333; nextHandle = -prewHandle*0.99; }
			else if (!prewMarker) { nextHandle = (nextMarkerPosition - position)*0.333; prewHandle = -nextHandle*0.99; }
			else 
			{ 
				nextHandle = Vector3.Slerp(-(prewMarker.position - position)*0.333, (nextMarkerPosition - position)*0.333, 0.5); 
				prewHandle = Vector3.Slerp((prewMarker.position - position)*0.333, -(nextMarkerPosition - position)*0.333, 0.5);
			}
			break;
			
		case MarkerType.Transform:
			if (!!prewMarker)
			{
				var prewDist : float = (position - prewMarker.position).magnitude;
				prewHandle = -transform.forward * transform.localScale.z * prewDist * 0.4;
			}
			if (!!nextMarker)
			{
				var nextDist : float = (position - nextMarkerPosition).magnitude;
				nextHandle = transform.forward * transform.localScale.z * nextDist * 0.4;	
			}
			break;
			
		case MarkerType.Corner:
			if (!!prewMarker) prewHandle = (prewMarker.position - position)*0.333; else prewHandle = Vector3(0,0,0);
			if (!!nextMarker) nextHandle = (nextMarkerPosition - position)*0.333; else nextHandle = Vector3(0,0,0);
			break; 
	}
	
	//avoiding zero-length handle vectors
	//if (nextHandle.sqrMagnitude==0 && prewHandle.sqrMagnitude==0) { nextHandle=Vector3(0.001,0,0); prewHandle=Vector3(-0.001,0,0); }
	if ((nextHandle-prewHandle).sqrMagnitude<0.01) nextHandle+=Vector3(0.001,0,0); 
}








