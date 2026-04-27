# Publish len GitHub bang GitHub Desktop

Repository name:

```text
DACN-traffic-etl
```

Visibility:

```text
Public
```

## Buoc 1: Add local repository

Mo GitHub Desktop:

```text
File -> Add local repository
```

Chon thu muc:

```text
C:\Users\hoang\Desktop\DACN
```

Neu GitHub Desktop bao chua phai Git repository, chon:

```text
create a repository
```

## Buoc 2: Kiem tra Changes truoc khi commit

Khong duoc commit cac file/thu muc sau:

```text
.env
.venv/
DACN w1.mp4
DACN w2.mp4
__pycache__/
```

Neu thay cac file tren trong tab Changes, dung lai va kiem tra `.gitignore`.

## Buoc 3: Commit

Summary:

```text
Initial traffic ETL pipeline
```

Bam:

```text
Commit to main
```

## Buoc 4: Publish repository

Bam:

```text
Publish repository
```

Thiet lap:

```text
Name: DACN-traffic-etl
Keep this code private: OFF
```

## Buoc 5: Them TomTom API key

Tren GitHub web:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Name:

```text
TOMTOM_API_KEY
```

Value: dan TomTom API key moi.

## Buoc 6: Kiem tra workflow

Vao:

```text
Actions -> Traffic ETL Scheduled Collection
```

Workflow se tu dong chay trong gio Viet Nam:

```text
06:00-08:00
11:00-13:00
16:00-19:00
```

Sau khi workflow chay thanh cong, du lieu se nam o:

```text
outputs/history/
outputs/processed/node_fusion_all.csv
outputs/processed/traffic_observations_all.csv
outputs/processed/main_summary.json
```

