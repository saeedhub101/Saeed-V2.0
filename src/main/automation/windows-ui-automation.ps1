param(
 [ValidateSet("Inspect","Act")][string]$Mode="Inspect",
 [int]$TargetPid=0,
 [string]$TargetWindowTitle="",
 [int]$Limit=150,
 [int]$ElementIndex=-1,
 [ValidateSet("invoke","set_value","select","toggle","focus","expand","collapse")][string]$Action="focus",
 [string]$Value="",
 [string]$ExpectedName="",
 [string]$AutomationId="",
 [string]$ControlType=""
)
$ErrorActionPreference="Stop"
try {
 Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes -ErrorAction Stop
 Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SaeedUiNative {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
"@
 $root=$null
 if($TargetPid -gt 0 -or $TargetWindowTitle) {
  $top=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
  foreach($candidate in $top) { try { $currentWindow=$candidate.Current;if(($TargetPid -le 0 -or $currentWindow.ProcessId -eq $TargetPid) -and (-not $TargetWindowTitle -or $currentWindow.Name -ceq $TargetWindowTitle)) { $root=$candidate; break } } catch {} }
 } else {
  $handle=[SaeedUiNative]::GetForegroundWindow()
  if($handle -ne [IntPtr]::Zero) { $root=[System.Windows.Automation.AutomationElement]::FromHandle($handle) }
 }
 if(-not $root) { throw "Target window not found or Windows UI Automation could not access it." }
 if($Mode -eq "Inspect") {
  $all=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
  $elements=New-Object System.Collections.Generic.List[object]
  $max=[Math]::Max(1,[Math]::Min(500,$Limit))
  for($i=0;$i -lt $all.Count -and $elements.Count -lt $max;$i++) {
   try {
    $element=$all.Item($i);$current=$element.Current;$rect=$current.BoundingRectangle
    $patterns=@()
    foreach($pattern in $element.GetSupportedPatterns()) { $patterns+= $pattern.ProgrammaticName }
    $elements.Add([pscustomobject]@{elementIndex=$i;name=$current.Name;automationId=$current.AutomationId;controlType=$current.ControlType.ProgrammaticName;className=$current.ClassName;isEnabled=$current.IsEnabled;isOffscreen=$current.IsOffscreen;processId=$current.ProcessId;boundingRectangle=@{x=$rect.X;y=$rect.Y;width=$rect.Width;height=$rect.Height};patterns=$patterns})
   } catch {}
  }
  [pscustomobject]@{ok=$true;windowTitle=$root.Current.Name;processId=$root.Current.ProcessId;totalElements=$all.Count;truncated=($all.Count -gt $max);elements=@($elements)} | ConvertTo-Json -Depth 7 -Compress
  exit 0
 }
 if($ElementIndex -lt 0) { throw "ElementIndex is required for UI Automation actions." }
 $all=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 if($ElementIndex -ge $all.Count) { throw "The inspected element index is no longer present. Re-inspect the window before acting." }
 $element=$all.Item($ElementIndex);$current=$element.Current
 if($ExpectedName -and $current.Name -cne $ExpectedName) { throw "Element identity changed (name mismatch). Re-inspect before acting." }
 if($AutomationId -and $current.AutomationId -cne $AutomationId) { throw "Element identity changed (AutomationId mismatch). Re-inspect before acting." }
 if($ControlType -and $current.ControlType.ProgrammaticName -cne $ControlType) { throw "Element identity changed (control type mismatch). Re-inspect before acting." }
 if($CheckBounds){$rect=$current.BoundingRectangle;if([Math]::Abs($rect.X-$ExpectedX)-gt 8 -or [Math]::Abs($rect.Y-$ExpectedY)-gt 8 -or [Math]::Abs($rect.Width-$ExpectedWidth)-gt 8 -or [Math]::Abs($rect.Height-$ExpectedHeight)-gt 8){throw "Element bounds changed since inspection. Re-inspect before acting."}}
 if(-not $current.IsEnabled -and $Action -ne "focus") { throw "Target UI element is disabled." }
 switch($Action) {
  "invoke" { $pattern=$null;if(-not $element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){throw "Element does not support InvokePattern."};$pattern.Invoke() }
  "set_value" { $pattern=$null;if(-not $element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$pattern)){throw "Element does not support ValuePattern; use keyboard input or another control."};if($pattern.Current.IsReadOnly){throw "Target value field is read-only."};$pattern.SetValue($Value) }
  "select" { $pattern=$null;if(-not $element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$pattern)){throw "Element does not support SelectionItemPattern."};$pattern.Select() }
  "toggle" { $pattern=$null;if(-not $element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern,[ref]$pattern)){throw "Element does not support TogglePattern."};$pattern.Toggle() }
  "focus" { $element.SetFocus() }
  "expand" { $pattern=$null;if(-not $element.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern,[ref]$pattern)){throw "Element does not support ExpandCollapsePattern."};$pattern.Expand() }
  "collapse" { $pattern=$null;if(-not $element.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern,[ref]$pattern)){throw "Element does not support ExpandCollapsePattern."};$pattern.Collapse() }
 }
 [pscustomobject]@{ok=$true;action=$Action;elementIndex=$ElementIndex;name=$current.Name;automationId=$current.AutomationId;controlType=$current.ControlType.ProgrammaticName;processId=$current.ProcessId;message="UI Automation action sent. Re-inspect the target state to verify the result."} | ConvertTo-Json -Depth 5 -Compress
} catch {
 [pscustomobject]@{ok=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress
}
