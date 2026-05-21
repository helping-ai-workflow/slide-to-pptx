' usage: cscript //nologo visual-regression-render.vbs <pptx-win-path> <outdir-win-path>
Set args = WScript.Arguments
pptxPath = args(0) : outDir = args(1)
Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FolderExists(outDir) Then fso.CreateFolder outDir
Set ppt = CreateObject("PowerPoint.Application")
ppt.Visible = True
Set pres = ppt.Presentations.Open(pptxPath, True, True, False)
i = 0
For Each slide In pres.Slides
    i = i + 1
    slide.Export outDir & "\" & Right("0" & i, 2) & ".png", "PNG", 1920, 1080
Next
pres.Close
ppt.Quit
