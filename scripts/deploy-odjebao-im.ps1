[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string]$LocalPath,

    [string]$FtpHost = "ftp.odjebao.me",

    [int]$Port = 21,

    [string]$Username = "srv65058",

    [string]$Password = "TOPIrbQCGf86",

    [switch]$ActiveMode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$remoteRoot = "/domains/odjebao.im/public_html"

function Get-ResolvedLocalPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    try {
        return (Resolve-Path -LiteralPath $Path).Path
    }
    catch {
        throw "Local path not found: $Path"
    }
}

function ConvertTo-RemotePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $parts = $Path.Trim("/") -split "/"
    $escaped = foreach ($part in $parts) {
        if ($part) {
            [Uri]::EscapeDataString($part)
        }
    }

    return "/" + ($escaped -join "/")
}

function New-FtpRequest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$RemotePath
    )

    $uri = "ftp://{0}:{1}{2}" -f $FtpHost, $Port, (ConvertTo-RemotePath -Path $RemotePath)
    $request = [System.Net.FtpWebRequest]::Create($uri)
    $request.Method = $Method
    $request.Credentials = [System.Net.NetworkCredential]::new($Username, $Password)
    $request.UseBinary = $true
    $request.UsePassive = -not $ActiveMode.IsPresent
    $request.KeepAlive = $false
    $request.EnableSsl = $false
    return $request
}

function Get-FtpErrorDetails {
    param(
        [Parameter(Mandatory = $true)]
        [System.Net.WebException]$Exception
    )

    if ($Exception.Response -is [System.Net.FtpWebResponse]) {
        $response = [System.Net.FtpWebResponse]$Exception.Response
        return $response.StatusDescription.Trim()
    }

    return $Exception.Message
}

function Invoke-FtpCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$RemotePath
    )

    $request = New-FtpRequest -Method $Method -RemotePath $RemotePath
    $response = $request.GetResponse()
    try {
        if ($response -is [System.Net.FtpWebResponse]) {
            return ([System.Net.FtpWebResponse]$response).StatusDescription.Trim()
        }

        return $null
    }
    finally {
        $response.Close()
    }
}

function Split-RemoteParent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RemotePath
    )

    $trimmed = $RemotePath.TrimEnd("/")
    $separatorIndex = $trimmed.LastIndexOf("/")

    if ($separatorIndex -lt 1) {
        return "/"
    }

    return $trimmed.Substring(0, $separatorIndex)
}

function Ensure-RemoteDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RemoteDirectory
    )

    $trimmed = $RemoteDirectory.Trim("/")
    if (-not $trimmed) {
        return
    }

    $current = ""
    foreach ($segment in ($trimmed -split "/")) {
        if (-not $segment) {
            continue
        }

        $current += "/$segment"

        if (-not $PSCmdlet.ShouldProcess($current, "Create remote directory")) {
            continue
        }

        try {
            [void](Invoke-FtpCommand -Method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory) -RemotePath $current)
            Write-Host "Created remote directory: $current"
        }
        catch [System.Net.WebException] {
            $details = Get-FtpErrorDetails -Exception $_.Exception
            if ($details -match "exists" -or $details -match "already" -or $details -match "^550") {
                continue
            }

            throw "Failed to create remote directory '$current': $details"
        }
    }
}

function Test-FtpAccess {
    try {
        [void](Invoke-FtpCommand -Method ([System.Net.WebRequestMethods+Ftp]::PrintWorkingDirectory) -RemotePath "/")
    }
    catch [System.Net.WebException] {
        $details = Get-FtpErrorDetails -Exception $_.Exception
        throw "FTP connection check failed: $details"
    }
}

function Get-RelativePathFromRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootPath,

        [Parameter(Mandatory = $true)]
        [string]$ChildPath
    )

    $normalizedRoot = [System.IO.Path]::GetFullPath($RootPath).TrimEnd("\", "/") + "\"
    $normalizedChild = [System.IO.Path]::GetFullPath($ChildPath)
    $rootUri = [Uri]$normalizedRoot
    $childUri = [Uri]$normalizedChild
    return [Uri]::UnescapeDataString($rootUri.MakeRelativeUri($childUri).ToString())
}

function Join-RemotePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,

        [Parameter(Mandatory = $true)]
        [string]$RelativePath
    )

    $normalizedRelative = ($RelativePath -split "[\\/]+" | Where-Object { $_ }) -join "/"
    if (-not $normalizedRelative) {
        return $BasePath
    }

    return ($BasePath.TrimEnd("/") + "/" + $normalizedRelative)
}

function Send-FileToFtp {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceFile,

        [Parameter(Mandatory = $true)]
        [string]$RemoteFile
    )

    $parent = Split-RemoteParent -RemotePath $RemoteFile
    Ensure-RemoteDirectory -RemoteDirectory $parent

    if (-not $PSCmdlet.ShouldProcess($RemoteFile, "Upload $SourceFile")) {
        return
    }

    $request = New-FtpRequest -Method ([System.Net.WebRequestMethods+Ftp]::UploadFile) -RemotePath $RemoteFile
    $bytes = [System.IO.File]::ReadAllBytes($SourceFile)
    $request.ContentLength = $bytes.Length

    $requestStream = $request.GetRequestStream()
    try {
        $requestStream.Write($bytes, 0, $bytes.Length)
    }
    finally {
        $requestStream.Close()
    }

    $response = $request.GetResponse()
    try {
        Write-Host ("Uploaded: {0} -> {1}" -f $SourceFile, $RemoteFile)
    }
    finally {
        $response.Close()
    }
}

$resolvedLocalPath = Get-ResolvedLocalPath -Path $LocalPath

Write-Host "Local path: $resolvedLocalPath"
Write-Host "Remote root: $remoteRoot"
Write-Host "FTP host: $FtpHost`:$Port"

Test-FtpAccess
Ensure-RemoteDirectory -RemoteDirectory $remoteRoot

$localItem = Get-Item -LiteralPath $resolvedLocalPath

if ($localItem.PSIsContainer) {
    $files = Get-ChildItem -LiteralPath $resolvedLocalPath -File -Recurse
    if (-not $files) {
        Write-Warning "No files found under $resolvedLocalPath"
        return
    }

    foreach ($file in $files) {
        $relativePath = Get-RelativePathFromRoot -RootPath $resolvedLocalPath -ChildPath $file.FullName
        $remoteFile = Join-RemotePath -BasePath $remoteRoot -RelativePath $relativePath
        Send-FileToFtp -SourceFile $file.FullName -RemoteFile $remoteFile
    }
}
else {
    $remoteFile = Join-RemotePath -BasePath $remoteRoot -RelativePath $localItem.Name
    Send-FileToFtp -SourceFile $localItem.FullName -RemoteFile $remoteFile
}

Write-Host "Deploy finished."
