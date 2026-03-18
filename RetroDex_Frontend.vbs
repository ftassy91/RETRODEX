' RetroDex_Frontend.vbs
' Lance le frontend canonique depuis RETRODEXseed

Option Explicit

Dim oShell, oFSO, oExec
Dim sFrontend, sPython
Dim i, bReady

Set oShell = CreateObject("WScript.Shell")
Set oFSO   = CreateObject("Scripting.FileSystemObject")

' === 1. Chemin frontend canonique ===
Dim sRoot
sRoot = oFSO.GetParentFolderName(WScript.ScriptFullName)
sFrontend = sRoot & "\RETRODEXseedV0\prototype_v0"

If Not oFSO.FolderExists(sFrontend) Then
    MsgBox "Dossier frontend introuvable." & vbCrLf & _
           "Chemin attendu : RETRODEXseedV0\prototype_v0", _
           vbCritical, "RetroDex Frontend"
    WScript.Quit 1
End If

' === 2. Trouver python ===
sPython = ""
Dim aPy(4)
aPy(0) = "python"
aPy(1) = "python3"
aPy(2) = oShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python312\python.exe"
aPy(3) = oShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python311\python.exe"
aPy(4) = "C:\Python311\python.exe"

Dim k
For k = 0 To 4
    On Error Resume Next
    Set oExec = oShell.Exec("cmd /c " & aPy(k) & " --version")
    If Err.Number = 0 Then
        oExec.WaitOnReturn
        If oExec.ExitCode = 0 Then
            sPython = aPy(k)
            Exit For
        End If
    End If
    On Error GoTo 0
Next

If sPython = "" Then
    MsgBox "Python introuvable." & vbCrLf & "Installer depuis https://python.org", _
           vbCritical, "RetroDex - Python manquant"
    WScript.Quit 1
End If

' === 3. Lancer le serveur ===
Dim sCmd : sCmd = "cmd /k cd /d """ & sFrontend & """ && title RetroDex Frontend && " & sPython & " -m http.server 8080"
oShell.Run sCmd, 1, False

' === 4. Attendre que le port 8080 reponde (max 15 sec) ===
bReady = False
Dim oHTTP : Set oHTTP = CreateObject("MSXML2.XMLHTTP")
For i = 1 To 15
    WScript.Sleep 1000
    On Error Resume Next
    oHTTP.open "GET", "http://localhost:8080/launcher.html", False
    oHTTP.send
    If Err.Number = 0 Then
        If oHTTP.status = 200 Then
            bReady = True
            Exit For
        End If
    End If
    On Error GoTo 0
Next

' === 5. Ouvrir le navigateur ===
oShell.Run "http://localhost:8080/launcher.html"
