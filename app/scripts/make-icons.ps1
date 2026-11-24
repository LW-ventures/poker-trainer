param([string]$OutDir = (Join-Path $PSScriptRoot '..\public'))
Add-Type -AssemblyName System.Drawing
function New-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $bg = [System.Drawing.ColorTranslator]::FromHtml('#0c1210')
  $gold = [System.Drawing.ColorTranslator]::FromHtml('#e3b341')
  $felt = [System.Drawing.ColorTranslator]::FromHtml('#123a2f')
  $g.Clear($bg)
  $s = $size / 512.0
  $m = 70 * $s
  $c = 78 * $s
  $r = $size - $m
  $pts = @(
    (New-Object System.Drawing.PointF(($m + $c), $m)),
    (New-Object System.Drawing.PointF($r, $m)),
    (New-Object System.Drawing.PointF($r, ($r - $c))),
    (New-Object System.Drawing.PointF(($r - $c), $r)),
    (New-Object System.Drawing.PointF($m, $r)),
    (New-Object System.Drawing.PointF($m, ($m + $c)))
  )
  $fill = New-Object System.Drawing.SolidBrush $felt
  $g.FillPolygon($fill, $pts)
  $pen = New-Object System.Drawing.Pen $gold, (10 * $s)
  $pen.LineJoin = 'Miter'
  $g.DrawPolygon($pen, $pts)
  $font = New-Object System.Drawing.Font 'Segoe UI Symbol', (250 * $s), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush $gold
  $text = [string][char]0x2660
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = 'Center'
  $sf.LineAlignment = 'Center'
  $rect = New-Object System.Drawing.RectangleF(0, (14 * $s), $size, $size)
  $g.DrawString($text, $font, $brush, $rect, $sf)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
New-Item -ItemType Directory -Force $OutDir | Out-Null
New-Icon 512 (Join-Path $OutDir 'icon-512.png')
New-Icon 192 (Join-Path $OutDir 'icon-192.png')
New-Icon 180 (Join-Path $OutDir 'apple-touch-icon.png')
'done'
