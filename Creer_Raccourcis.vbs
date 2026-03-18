' Creer_Raccourcis.vbs
' Cree les icones sur le Bureau

Dim oWS, oLink, sDesktop, sHere
Set oWS = CreateObject("WScript.Shell")
sDesktop = oWS.SpecialFolders("Desktop")
sHere = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

Set oLink = oWS.CreateShortcut(sDesktop & "\RetroDex Backend.lnk")
oLink.TargetPath = "wscript.exe"
oLink.Arguments = """" & sHere & "RetroDex_Backend.vbs"""
oLink.WorkingDirectory = sHere
oLink.Description = "RetroDex Backend port 3000"
oLink.IconLocation = "C:\Windows\System32\wscript.exe, 0"
oLink.Save

Set oLink = oWS.CreateShortcut(sDesktop & "\RetroDex Frontend.lnk")
oLink.TargetPath = "wscript.exe"
oLink.Arguments = """" & sHere & "RetroDex_Frontend.vbs"""
oLink.WorkingDirectory = sHere
oLink.Description = "RetroDex Frontend port 8080"
oLink.IconLocation = "C:\Windows\System32\wscript.exe, 0"
oLink.Save

MsgBox "Raccourcis crees !" & vbCrLf & vbCrLf & _
       "RetroDex Backend  -> port 3000" & vbCrLf & _
       "RetroDex Frontend -> port 8080", vbInformation, "RetroDex"