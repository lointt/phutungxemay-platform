# ==============================================================================
# Script: scripts/deploy-aws.ps1
# Mo ta: Dong goi va trien khai Next.js len AWS Serverless qua OpenNext (PowerShell)
# Target:
#   - Static Assets -> AWS S3 (phutungxemay-frontend-hosting-2026)
#   - Server Runtime -> AWS Lambda (NextjsServerHandler)
#   - CDN Invalidation -> CloudFront (d1ksuy3hfmko20.cloudfront.net)
# ==============================================================================

[CmdletBinding()]
param (
    [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-southeast-1" }),
    [string]$Bucket = $(if ($env:S3_BUCKET) { $env:S3_BUCKET } else { "phutungxemay-frontend-hosting-2026" }),
    [string]$LambdaName = $(if ($env:LAMBDA_FUNCTION_NAME) { $env:LAMBDA_FUNCTION_NAME } else { "NextjsServerHandler" }),
    [string]$CloudFrontDomain = "d1ksuy3hfmko20.cloudfront.net",
    [string]$DistributionId = $env:CLOUDFRONT_DISTRIBUTION_ID
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "======================================================================" -ForegroundColor Blue
Write-Host ">> BAT DAU QUY TRINH DEPLOY NEXT.JS (OPENNEXT) LEN AWS SERVERLESS" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Blue
Write-Host "Project Root    : $ProjectRoot"
Write-Host "AWS Region      : $Region"
Write-Host "S3 Bucket       : $Bucket"
Write-Host "Lambda Function : $LambdaName"
Write-Host "CloudFront CNAME: $CloudFrontDomain"
Write-Host "----------------------------------------------------------------------" -ForegroundColor Blue

# Kiem tra AWS CLI
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Error "Loi: Chua cai dat hoac chua cau hinh AWS CLI. Vui long cai AWS CLI va cau hinh 'aws configure'."
    exit 1
}

Set-Location $ProjectRoot

# ------------------------------------------------------------------------------
# BUOC 1: Build du an voi OpenNext
# ------------------------------------------------------------------------------
Write-Host "`n[1/5] Dang build Next.js voi OpenNext..." -ForegroundColor Yellow
npm run build:open-next

if (-not (Test-Path ".open-next")) {
    Write-Error "Loi: Thu muc .open-next khong ton tai sau khi build!"
    exit 1
}
Write-Host "[OK] Build OpenNext thanh cong!" -ForegroundColor Green

# ------------------------------------------------------------------------------
# BUOC 2: Dong bo Static Assets len AWS S3
# ------------------------------------------------------------------------------
Write-Host "`n[2/5] Dang dong bo Static Assets len S3 Bucket: $Bucket..." -ForegroundColor Yellow

# a. Dong bo immutable static chunks (_next/static/*) voi Cache-Control 1 nam
if (Test-Path ".open-next\assets\_next") {
    Write-Host "  -> Uploading _next assets (Cache-Control: 1 year, immutable)..." -ForegroundColor Cyan
    aws s3 sync ".open-next/assets/_next" "s3://$Bucket/_next" --region $Region --cache-control "public, max-age=31536000, immutable"
}

# b. Dong bo root assets (HTML, favicon.ico, images, icons, BUILD_ID) voi must-revalidate
Write-Host "  -> Uploading root public and HTML assets (Cache-Control: no-cache, must-revalidate)..." -ForegroundColor Cyan
aws s3 sync ".open-next/assets" "s3://$Bucket" --region $Region --exclude "_next/*" --cache-control "public, max-age=0, must-revalidate"

Write-Host "[OK] Dong bo S3 Static Assets hoan tat!" -ForegroundColor Green

# ------------------------------------------------------------------------------
# BUOC 3: Dong goi ma nguon Lambda (function.zip)
# ------------------------------------------------------------------------------
Write-Host "`n[3/5] Dang dong goi ma nguon Serverless Function (.open-next/server-functions/default)..." -ForegroundColor Yellow

$ServerDir = Join-Path $ProjectRoot ".open-next\server-functions\default"
$ZipFile = Join-Path $ProjectRoot "function.zip"

if (Test-Path $ZipFile) { Remove-Item $ZipFile -Force }

Compress-Archive -Path "$ServerDir\*" -DestinationPath $ZipFile -CompressionLevel Optimal

$ZipSizeMB = [math]::Round((Get-Item $ZipFile).Length / 1MB, 2)
Write-Host "[OK] Dong goi function.zip thanh cong (~$ZipSizeMB MB)" -ForegroundColor Green

# ------------------------------------------------------------------------------
# BUOC 4: Cap nhat ma nguon Lambda Function tren AWS
# ------------------------------------------------------------------------------
Write-Host "`n[4/5] Dang day code len AWS Lambda function: $LambdaName..." -ForegroundColor Yellow

aws lambda update-function-code --function-name $LambdaName --zip-file "fileb://$ZipFile" --region $Region --output json | Out-Null

Write-Host "  -> Dang doi Lambda chuyen sang trang thai Successful..." -ForegroundColor Cyan
aws lambda wait function-updated --function-name $LambdaName --region $Region

Write-Host "[OK] Cap nhat Lambda Function thanh cong!" -ForegroundColor Green

# ------------------------------------------------------------------------------
# BUOC 5: Tu dong Invalidation CloudFront CDN Cache
# ------------------------------------------------------------------------------
Write-Host "`n[5/5] Dang kiem tra va tao CloudFront Invalidation (/*)..." -ForegroundColor Yellow

if (-not $DistributionId) {
    Write-Host "  -> Dang tim Distribution ID cho domain $CloudFrontDomain..." -ForegroundColor Cyan
    $DistributionId = aws cloudfront list-distributions --query "DistributionList.Items[?DomainName=='$CloudFrontDomain'].Id" --output text 2>$null
}

if ($DistributionId -and $DistributionId -ne "None") {
    Write-Host "  -> Tao Invalidation cho Distribution: $DistributionId..." -ForegroundColor Cyan
    $InvalidationId = aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --query "Invalidation.Id" --output text
    Write-Host "[OK] Da kich hoat CloudFront Invalidation ID: $InvalidationId" -ForegroundColor Green
} else {
    Write-Host "[WARN] Khong tim thay CloudFront Distribution ID tuong ung voi domain $CloudFrontDomain." -ForegroundColor Yellow
    Write-Host "  Ban co the chay thu cong: aws cloudfront create-invalidation --distribution-id <ID> --paths '/*'" -ForegroundColor Yellow
}

# Don dep file zip tam
if (Test-Path $ZipFile) { Remove-Item $ZipFile -Force }

Write-Host "`n======================================================================" -ForegroundColor Blue
Write-Host ">> DEPLOY HOAN TAT THANH CONG!" -ForegroundColor Green
Write-Host "Website: https://$CloudFrontDomain" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Blue
