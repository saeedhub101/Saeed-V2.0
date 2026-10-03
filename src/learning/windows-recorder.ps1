param([int]$IgnorePid=0)
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class SaeedRecorderNative {
 [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
 [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd,StringBuilder text,int count);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd,out uint pid);
}
"@
function Json($o){$o|ConvertTo-Json -Compress -Depth 6}
function Context {
 $hw=[SaeedRecorderNative]::GetForegroundWindow();$pid=0;[void][SaeedRecorderNative]::GetWindowThreadProcessId($hw,[ref]$pid)
 $sb=New-Object Text.StringBuilder 512;[void][SaeedRecorderNative]::GetWindowText($hw,$sb,$sb.Capacity)
 [pscustomobject]@{pid=[int]$pid;title=$sb.ToString()}
}
$keys=@{}
$names=@{}
0..255|%{$keys[$_]=false}
$names[8]="BACKSPACE";$names[9]="TAB";$names[13]="ENTER";$names[16]="SHIFT";$names[17]="CTRL";$names[18]="ALT";$names[27]="ESC";$names[32]="SPACE";$names[33]="PAGEUP";$names[34]="PAGEDOWN";$names[35]="END";$names[36]="HOME";$names[37]="LEFT";$names[38]="UP";$names[39]="RIGHT";$names[40]="DOWN";$names[45]="INSERT";$names[46]="DELETE"
for($i=65;$i -le 90;$i++){$names[$i]=[char]$i}
for($i=48;$i -le 57;$i++){$names[$i]=[char]$i}
for($i=112;$i -le 123;$i++){$names[$i]="F"+($i-111)}
$lastL=$false;$lastR=$false
while($true){
 $ctx=Context
 $p=New-Object 'SaeedRecorderNative+POINT';[void][SaeedRecorderNative]::GetCursorPos([ref]$p)
 $target=[SaeedRecorderNative]::WindowFromPoint($p)
 $tpid=0;[void][SaeedRecorderNative]::GetWindowThreadProcessId($target,[ref]$tpid)
 if($tpid -ne $IgnorePid -and $ctx.pid -ne $IgnorePid){
   $l=([SaeedRecorderNative]::GetAsyncKeyState(1) -band 0x8000) -ne 0
   $r=([SaeedRecorderNative]::GetAsyncKeyState(2) -band 0x8000) -ne 0
   if($l -and -not $lastL){Json([pscustomobject]@{type="action";tool="mouse_click";args=@{x=$p.X;y=$p.Y;button="left";_window=$ctx}})}
   if($r -and -not $lastR){Json([pscustomobject]@{type="action";tool="mouse_click";args=@{x=$p.X;y=$p.Y;button="right";_window=$ctx}})}
   $lastL=$l;$lastR=$r
   foreach($vk in $names.Keys){
     $down=([SaeedRecorderNative]::GetAsyncKeyState([int]$vk) -band 0x8000) -ne 0
     if($down -and -not $keys[$vk]){
       $name=[string]$names[$vk]
       Json([pscustomobject]@{type="action";tool="key_press";args=@{key=$name;_window=$ctx}})
     }
     $keys[$vk]=$down
   }
 } else {$lastL=$false;$lastR=$false}
 Start-Sleep -Milliseconds 35
}
