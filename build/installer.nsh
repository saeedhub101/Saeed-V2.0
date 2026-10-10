; Saeed AI — Windows NSIS cleanup
; The default uninstaller removes the selected installation directory.
; Preserve per-user settings, credentials, conversations, memory, and character data
; so uninstalling or reinstalling the application does not silently destroy user data.

!macro customUnInstall
  DetailPrint "Saeed AI user data has been preserved."
!macroend
