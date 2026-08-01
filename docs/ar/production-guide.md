# دليل النشر في الإنتاج

يرشدك هذا الدليل خطوة بخطوة إلى نشر فنك على خادم إنتاج. يغطي إعداد الخادم، وتهيئة الوكيل العكسي مع SSL، وقواعد جدار الحماية، والنسخ الاحتياطي، والصيانة المستمرة.

تتم تهيئة تطبيق فنك نفسه (اسم المؤسسة، وكتالوج الخدمات، والمستخدمون) بالكامل من واجهة الإدارة بعد النشر. يغطي هذا الدليل إعداد البنية التحتية فقط: تثبيت التطبيق، وإتاحته عبر HTTPS، وإبقاءه آمناً.

## المحتويات

1. [المتطلبات المسبقة](#1-المتطلبات-المسبقة)
2. [نشر فنك](#2-نشر-فنك)
3. [تهيئة DNS](#3-تهيئة-dns)
4. [إعداد الوكيل العكسي](#4-إعداد-الوكيل-العكسي)
5. [جدار الحماية وتقوية الأمان](#5-جدار-الحماية-وتقوية-الأمان)
6. [النسخ الاحتياطي](#6-النسخ-الاحتياطي)
7. [التحديثات والترقيات](#7-التحديثات-والترقيات)
8. [استكشاف الأخطاء وإصلاحها](#8-استكشاف-الأخطاء-وإصلاحها)
9. [المراقبة والتنبيهات](#9-المراقبة-والتنبيهات)


## 1. المتطلبات المسبقة

ستحتاج إلى:

- **خادم لينكس** -- أوبونتو 22.04، أو أوبونتو 24.04، أو دبيان 12. تعمل التوزيعات الأخرى، لكن الأوامر في هذا الدليل موجّهة للأنظمة المعتمدة على apt.
- **اسم نطاق** -- مثلاً `fanek.example.com`. للنشر المتاح عبر الإنترنت، وجّه النطاق إلى عنوان IP الخاص بخادمك قبل البدء (راجع [القسم 3](#3-تهيئة-dns)). للنشر الداخلي على الشبكة المحلية، يمكنك استخدام مدخلات `/etc/hosts` بدلاً من ذلك.
- **وصول SSH** -- بمستخدم غير الجذر لديه صلاحيات `sudo`.
- **منافذ مفتوحة** -- 22 (SSH)، و80 (HTTP)، و443 (HTTPS).

اختر إحدى طريقتي النشر التاليتين:

| الطريقة | ما تقدّمه أنت | ما يتولاه فنك |
|---------|--------------|---------------|
| **Docker** (الطريقة الموصى بها) | Docker وDocker Compose | قاعدة البيانات، والمفاتيح السرية، والترحيلات، وإدارة العمليات |
| **التثبيت المباشر** (Bare-metal) | Node.js 20 أو أحدث، PostgreSQL 16 أو أحدث | التطبيق فقط |

يُنصح بطريقة Docker لأن نص نقطة الدخول يتولى تلقائياً توليد المفاتيح السرية، والتحقق من جاهزية قاعدة البيانات، وترحيلات المخطط. أما في التثبيت المباشر فأنت من يدير هذه الخطوات بنفسك.

### تثبيت Docker (إن كنت تستخدم طريقة Docker)

```bash
# تثبيت الحزم اللازمة لإضافة مستودع Docker
sudo apt update
sudo apt install -y ca-certificates curl

# إضافة مفتاح GPG الرسمي لـ Docker
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# إضافة مستودع Docker إلى مصادر apt
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# تثبيت محرك Docker وواجهة سطر الأوامر وإضافة Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# السماح لمستخدمك بتشغيل Docker دون sudo
sudo usermod -aG docker $USER

# لتطبيق تغييرات المجموعة، يجب تسجيل الخروج ثم الدخول مرة أخرى.

# بعد إعادة تسجيل الدخول، تحقق من التثبيت:
docker --version
docker compose version
```

لدبيان، استبدل `ubuntu` بـ `debian` في رابط المستودع أعلاه. راجع [توثيق Docker الرسمي](https://docs.docker.com/engine/install/) للتوزيعات الأخرى.


## 2. نشر فنك

### الخيار أ: Docker (الطريقة الموصى بها)

**الخطوة 1: استنسخ المستودع.**

```bash
# استنساخ فنك إلى /opt/fanek
sudo mkdir -p /opt/fanek
sudo chown $USER:$USER /opt/fanek
git clone https://github.com/mulaifi/fanek.git /opt/fanek
cd /opt/fanek
```

**الخطوة 2: أنشئ ملف `.env`.**

```bash
# نسخ ملف البيئة النموذجي
cp .env.example .env
```

افتح `.env` واضبط هذه القيم:

```bash
# اضبط رابط التطبيق على نطاقك (يجب أن يطابق الرابط الذي يصل منه المستخدمون في المتصفح)
NEXTAUTH_URL=https://fanek.example.com

# اضبط البيئة على وضع الإنتاج
NODE_ENV=production
```

لست بحاجة إلى ضبط `NEXTAUTH_SECRET` في عمليات النشر عبر Docker. يولّد نص نقطة الدخول مفتاحاً سرياً آمناً تلقائياً عند التشغيل الأول ويحفظه في وحدة تخزين `data` في المسار `/data/secrets/nextauth_secret`. كما لست بحاجة إلى ضبط `DATABASE_URL`، لأن Docker Compose يوفّر اتصال قاعدة البيانات داخلياً.

**الخطوة 3: اربط التطبيق بالمضيف المحلي فقط.**

افتراضياً، يعرض `docker-compose.yml` فنك على جميع الواجهات ويعرض منفذ PostgreSQL. في الإنتاج، يتولى الوكيل العكسي حركة المرور الخارجية، لذا ينبغي أن يستمع فنك على `127.0.0.1` فقط. أنشئ ملف `docker-compose.override.yml`:

```yaml
# docker-compose.override.yml
# يقصر فنك على المضيف المحلي (يمرر الوكيل العكسي حركة المرور إليه)
# ويزيل منفذ PostgreSQL المعروض حفاظاً على الأمان.
#
# ملاحظة: صيغة !reset تتطلب Docker Compose الإصدار 2.24.6 أو أحدث.
# تحقق من إصدارك بالأمر: docker compose version
services:
  app:
    ports:
      # اربط فنك بالمضيف المحلي فقط، حتى لا يكون متاحاً مباشرة من الخارج
      - "127.0.0.1:${PORT:-8080}:${PORT:-8080}"
  db:
    # إزالة منفذ PostgreSQL المعروض بالكامل
    ports: !reset []
```

> **مهم:** صيغة `!reset` تتطلب Docker Compose الإصدار 2.24.6 أو أحدث. تحقق من إصدارك بالأمر `docker compose version`. إذا كان إصدارك أقدم، فرقّ Docker Compose أو احذف مفتاح `ports` من ملف `docker-compose.yml` الأساسي يدوياً بدلاً من ذلك.

**الخطوة 4: شغّل التطبيق.**

```bash
# بناء جميع الحاويات وتشغيلها في الخلفية
docker compose up -d --build
```

**الخطوة 5: تحقق من أن فنك يعمل.**

```bash
# تحقق من استجابة التطبيق على المضيف المحلي
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080
# المخرجات المتوقعة: 200 (أو 302 عند إعادة التوجيه إلى تسجيل الدخول أو الإعداد)
```

يمكنك أيضاً مراجعة سجلات الحاوية:

```bash
# عرض أحدث سجلات التطبيق
docker compose logs --tail 50 app
```

### الخيار ب: التثبيت المباشر

**الخطوة 1: ثبّت Node.js 20.**

```bash
# إضافة مستودع NodeSource لـ Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# تثبيت Node.js
sudo apt install -y nodejs

# التحقق
node --version
npm --version
```

**الخطوة 2: ثبّت PostgreSQL 16.**

```bash
# إضافة مستودع PostgreSQL
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y

# تثبيت PostgreSQL 16
sudo apt install -y postgresql-16

# تشغيل الخدمة وتفعيلها عند الإقلاع
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

**الخطوة 3: أنشئ قاعدة البيانات والمستخدم.**

```bash
# إنشاء مستخدم PostgreSQL (سيُطلب منك إدخال كلمة مرور)
sudo -u postgres createuser --pwprompt fanek

# إنشاء قاعدة البيانات، مملوكة للمستخدم fanek
sudo -u postgres createdb -O fanek fanek
```

احفظ كلمة المرور التي اخترتها. ستحتاجها في `DATABASE_URL` في الخطوة التالية.

**الخطوة 4: استنسخ التطبيق وابنِه.**

```bash
# إنشاء مستخدم نظام لتشغيل فنك
sudo useradd --system --create-home --home-dir /opt/fanek --shell /bin/bash fanek

# استنساخ المستودع
sudo -u fanek git clone https://github.com/mulaifi/fanek.git /opt/fanek
cd /opt/fanek

# تثبيت تبعيات الإنتاج
sudo -u fanek npm ci

# توليد عميل Prisma
sudo -u fanek npx prisma generate

# تشغيل ترحيلات قاعدة البيانات
sudo -u fanek npx prisma migrate deploy

# بناء تطبيق Next.js
sudo -u fanek npm run build
```

**الخطوة 5: أنشئ ملف `.env`.**

```bash
sudo -u fanek nano /opt/fanek/.env
```

أضف ما يلي (استبدل كلمة المرور بالتي ضبطتها في الخطوة 3):

```bash
# سلسلة اتصال قاعدة البيانات
DATABASE_URL="postgresql://fanek:YOUR_PASSWORD_HERE@localhost:5432/fanek"

# مفتاح توقيع الجلسات في NextAuth.js (مطلوب)
# ولّد قيمة عشوائية آمنة أدناه
NEXTAUTH_SECRET=""

# رابط التطبيق (يجب أن يطابق الرابط الذي يصل منه المستخدمون في المتصفح)
NEXTAUTH_URL="https://fanek.example.com"

# وضع الإنتاج
NODE_ENV=production
```

ولّد `NEXTAUTH_SECRET` واضبطه:

```bash
# توليد مفتاح سري آمن بطول 32 بايت بصيغة hex
SECRET=$(openssl rand -hex 32)

# كتابته في ملف .env
sudo -u fanek sed -i "s/^NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=\"$SECRET\"/" /opt/fanek/.env

# التحقق من ضبطه (ينبغي أن يظهر نص hex بطول 64 حرفاً)
grep NEXTAUTH_SECRET /opt/fanek/.env
```

**الخطوة 6: أنشئ خدمة systemd.**

أنشئ الملف `/etc/systemd/system/fanek.service`:

```bash
sudo nano /etc/systemd/system/fanek.service
```

الصق ما يلي:

```ini
[Unit]
# وصف الخدمة وترتيب التشغيل
Description=Fanek
After=network.target postgresql.service

[Service]
# التشغيل بمستخدم fanek المخصص
Type=simple
User=fanek
WorkingDirectory=/opt/fanek

# تشغيل خادم Next.js للإنتاج على المنفذ 8080
ExecStart=/usr/bin/node node_modules/.bin/next start -p 8080

# إعادة التشغيل تلقائياً عند الفشل، بتأخير 5 ثوانٍ
Restart=on-failure
RestartSec=5

# تحميل متغيرات البيئة من ملف .env
EnvironmentFile=/opt/fanek/.env

[Install]
# التشغيل عند الإقلاع
WantedBy=multi-user.target
```

**الخطوة 7: فعّل الخدمة وشغّلها.**

```bash
# إعادة تحميل systemd لالتقاط ملف الخدمة الجديد
sudo systemctl daemon-reload

# تفعيل الخدمة لتعمل عند الإقلاع
sudo systemctl enable fanek

# تشغيل الخدمة الآن
sudo systemctl start fanek

# التحقق من الحالة
sudo systemctl status fanek
```

**الخطوة 8: تحقق من أن فنك يعمل.**

```bash
# تحقق من استجابة التطبيق على المضيف المحلي
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080
# المخرجات المتوقعة: 200 (أو 302 عند إعادة التوجيه إلى تسجيل الدخول أو الإعداد)
```

إذا كان هناك خلل، راجع السجلات:

```bash
# عرض سجلات الخدمة
journalctl -u fanek --no-pager -n 50
```

### معالج الإعداد

في أول مرة تفتح فيها فنك في المتصفح، سيرشدك معالج الإعداد إلى إنشاء حساب مسؤول وتهيئة مؤسستك. لا تشغّل معالج الإعداد قبل تهيئة الوكيل العكسي وSSL (القسم 4)، حتى تنتقل بيانات اعتماد المسؤول عبر اتصال مشفّر.


## 3. تهيئة DNS

قبل تهيئة الوكيل العكسي، تأكد من أن اسم نطاقك يُترجم إلى عنوان IP الخاص بخادمك.

### النشر المتاح عبر الإنترنت

سجّل الدخول إلى مسجّل النطاق أو مزوّد DNS وأنشئ **سجل A**:

| النوع | الاسم | القيمة | TTL |
|-------|-------|--------|-----|
| A | fanek | 203.0.113.10 | 300 |

استبدل `fanek` بالنطاق الفرعي الذي اخترته و`203.0.113.10` بعنوان IP العام لخادمك. إذا كان نطاقك `fanek.example.com`، فحقل "الاسم" هو `fanek` (يضيف المسجّل `.example.com` تلقائياً).

قد يستغرق انتشار DNS من بضع دقائق إلى 48 ساعة، بحسب مزوّدك وإعدادات TTL. تنتشر معظم التغييرات خلال 5 إلى 15 دقيقة.

### النشر الداخلي على الشبكة المحلية

إذا كان خادمك على شبكة داخلية، فأمامك خياران:

**الخيار 1: خادم DNS داخلي.** أضف سجل A في خادم DNS الداخلي لديك (مثل DNS في Active Directory، أو Pi-hole، أو dnsmasq) يوجّه `fanek.company.local` إلى عنوان IP الداخلي للخادم.

**الخيار 2: ملف `/etc/hosts`.** على كل جهاز يحتاج للوصول إلى فنك، أضف سطراً إلى `/etc/hosts`:

```bash
# أضف هذا السطر إلى /etc/hosts على كل جهاز عميل
echo "192.168.1.50  fanek.company.local" | sudo tee -a /etc/hosts
```

استبدل `192.168.1.50` بعنوان IP الداخلي لخادمك.

### التحقق من ترجمة DNS

```bash
# أي من هذه الأوامر ينبغي أن يعيد عنوان IP الخاص بخادمك
ping -c 1 fanek.example.com
nslookup fanek.example.com
dig +short fanek.example.com
```


## 4. إعداد الوكيل العكسي

يقع الوكيل العكسي بين الإنترنت (أو شبكتك المحلية) وفنك. يتولى إنهاء SSL/TLS، فتكون حركة المرور بين المستخدمين والخادم مشفّرة. يستمع فنك نفسه على `http://127.0.0.1:8080`، ويمرر الوكيل العكسي الطلبات إليه.

### اختيار الوكيل العكسي

| الميزة | Caddy | Nginx | Traefik |
|--------|-------|-------|---------|
| HTTPS تلقائي | نعم (مدمج) | لا (يتطلب Certbot) | نعم (مدمج) |
| أسلوب التهيئة | ملف نصي بسيط | كتل تهيئة مفصّلة | وسوم Docker أو YAML |
| الأنسب لـ | البساطة والفرق الصغيرة | التحكم الكامل والإلمام المسبق | سير العمل القائم على Docker |
| صعوبة التعلّم | منخفضة | متوسطة | متوسطة |

الثلاثة جميعاً صالحة للإنتاج. إن لم تكن متأكداً، فـ**Caddy** هو الخيار الأبسط لأنه يتولى شهادات SSL تلقائياً دون أي تهيئة إضافية.

### الخيار أ: Caddy

يحصل Caddy على شهادات Let's Encrypt ويجددها تلقائياً. لا حاجة لأي خطوات SSL إضافية.

**الخطوة 1: ثبّت Caddy.**

```bash
# تثبيت المتطلبات
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

# إضافة مفتاح GPG الخاص بـ Caddy
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

# إضافة مستودع apt الخاص بـ Caddy
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

# تثبيت Caddy
sudo apt update
sudo apt install -y caddy
```

**الخطوة 2: هيّئ Caddy.**

افتح `/etc/caddy/Caddyfile`:

```bash
sudo nano /etc/caddy/Caddyfile
```

استبدل المحتوى بما يلي:

```
# تهيئة الوكيل العكسي لفنك
# يحصل Caddy على شهادات Let's Encrypt ويجددها تلقائياً
fanek.example.com {
    # تمرير جميع الطلبات إلى تطبيق فنك
    reverse_proxy localhost:8080
}
```

استبدل `fanek.example.com` بنطاقك الفعلي.

**الخطوة 3: شغّل Caddy.**

```bash
# إعادة تحميل Caddy لتطبيق التهيئة الجديدة
sudo systemctl reload caddy

# التحقق من أن Caddy يعمل
sudo systemctl status caddy
```

**الخطوة 4: تحقق.**

```bash
# اختبار HTTPS (ينبغي أن يعيد 200 أو 302)
curl -I https://fanek.example.com
```

### الخيار ب: Nginx

**الخطوة 1: ثبّت Nginx.**

```bash
sudo apt install -y nginx
```

**الخطوة 2: أنشئ ملف تهيئة الموقع في Nginx.**

```bash
sudo nano /etc/nginx/sites-available/fanek
```

الصق ما يلي:

```nginx
# تهيئة الوكيل العكسي لفنك في Nginx
server {
    # الاستماع على المنفذ 80 (HTTP) مبدئياً؛ سيضيف Certbot دعم HTTPS لاحقاً
    listen 80;
    server_name fanek.example.com;

    location / {
        # تمرير الطلبات إلى تطبيق فنك
        proxy_pass http://127.0.0.1:8080;

        # استخدام HTTP/1.1 لاتصالات الوكيل (مطلوب لدعم WebSocket)
        proxy_http_version 1.1;

        # تمرير المضيف الأصلي ومعلومات العميل إلى فنك
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # تفعيل دعم WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

استبدل `fanek.example.com` بنطاقك الفعلي.

**الخطوة 3: فعّل الموقع واحذف الموقع الافتراضي.**

```bash
# إنشاء رابط رمزي لتفعيل الموقع
sudo ln -s /etc/nginx/sites-available/fanek /etc/nginx/sites-enabled/

# حذف موقع Nginx الافتراضي لتجنب التعارض
sudo rm -f /etc/nginx/sites-enabled/default

# اختبار التهيئة بحثاً عن أخطاء في الصياغة
sudo nginx -t

# إعادة تحميل Nginx لتطبيق التهيئة
sudo systemctl reload nginx
```

**الخطوة 4: هيّئ SSL باستخدام Certbot.**

```bash
# تثبيت Certbot وإضافة Nginx
sudo apt install -y certbot python3-certbot-nginx

# الحصول على شهادة Let's Encrypt وتثبيتها
# سيعدّل Certbot تهيئة Nginx لإضافة توجيهات SSL تلقائياً
sudo certbot --nginx -d fanek.example.com

# التحقق من عمل التجديد التلقائي
sudo certbot renew --dry-run
```

يضيف Certbot مؤقّت systemd يجدد الشهادات تلقائياً قبل انتهاء صلاحيتها.

**الخطوة 5: تحقق.**

```bash
# اختبار HTTPS (ينبغي أن يعيد 200 أو 302)
curl -I https://fanek.example.com
```

### الخيار ج: Traefik (مع Docker فقط)

يتكامل Traefik مباشرة مع Docker، فيقرأ وسوم الحاويات لتهيئة التوجيه وSSL. هذا الأسلوب هو الأنسب إن كنت تستخدم Docker لفنك أصلاً.

**الخطوة 1: أنشئ `docker-compose.prod.yml`.**

يوسّع هذا الملف ملف `docker-compose.yml` الأساسي بإضافة Traefik كوكيل عكسي:

```bash
nano /opt/fanek/docker-compose.prod.yml
```

الصق ما يلي:

```yaml
# docker-compose.prod.yml
# يضيف Traefik كوكيل عكسي مع شهادات Let's Encrypt تلقائية.
# يُستخدم بالأمر: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
#
# ملاحظة: صيغة !reset تتطلب Docker Compose الإصدار 2.24.6 أو أحدث.
services:
  traefik:
    image: traefik:v3
    command:
      # تفعيل مزوّد Docker ليقرأ Traefik وسوم الحاويات
      - "--providers.docker=true"
      # عدم عرض الحاويات افتراضياً (فقط تلك التي تحمل traefik.enable=true)
      - "--providers.docker.exposedbydefault=false"
      # الاستماع على المنفذ 80 لـ HTTP
      - "--entrypoints.web.address=:80"
      # الاستماع على المنفذ 443 لـ HTTPS
      - "--entrypoints.websecure.address=:443"
      # تهيئة Let's Encrypt للشهادات التلقائية
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      # إعادة توجيه كل حركة HTTP إلى HTTPS
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
    ports:
      # عرض HTTP وHTTPS على المضيف
      - "80:80"
      - "443:443"
    volumes:
      # السماح لـ Traefik بقراءة وسوم حاويات Docker (للقراءة فقط حفاظاً على الأمان)
      - /var/run/docker.sock:/var/run/docker.sock:ro
      # حفظ شهادات Let's Encrypt عبر عمليات إعادة التشغيل
      - letsencrypt:/letsencrypt

  app:
    labels:
      # تفعيل Traefik لهذه الحاوية
      - "traefik.enable=true"
      # توجيه طلبات هذا النطاق إلى حاوية فنك
      - "traefik.http.routers.fanek.rule=Host(`fanek.example.com`)"
      # استخدام نقطة دخول HTTPS
      - "traefik.http.routers.fanek.entrypoints=websecure"
      # استخدام Let's Encrypt للحصول على الشهادة
      - "traefik.http.routers.fanek.tls.certresolver=letsencrypt"
      # إخبار Traefik بالمنفذ الذي يستمع عليه التطبيق داخل الحاوية
      - "traefik.http.services.fanek.loadbalancer.server.port=8080"
    # إزالة ربط المنفذ المباشر لأن Traefik يتولى حركة المرور الخارجية
    ports: !reset []

volumes:
  letsencrypt:
```

استبدل `fanek.example.com` بنطاقك الفعلي و`admin@example.com` ببريدك الإلكتروني (يُستخدم للتسجيل في Let's Encrypt وإشعارات انتهاء الصلاحية).

> **مهم:** صيغة `!reset` تتطلب Docker Compose الإصدار 2.24.6 أو أحدث. تحقق من إصدارك بالأمر `docker compose version`.

**الخطوة 2: إن كنت قد أنشأت ملف `docker-compose.override.yml`**، فاحذفه أو أعد تسميته. يعدّل ملف التجاوز وملف الإنتاج كلاهما منافذ `app`، فاستخدامهما معاً يسبب تعارضاً:

```bash
# إعادة تسمية ملف التجاوز إن كان موجوداً
mv /opt/fanek/docker-compose.override.yml /opt/fanek/docker-compose.override.yml.bak 2>/dev/null || true
```

**الخطوة 3: شغّل كل شيء.**

```bash
cd /opt/fanek

# تشغيل فنك مع Traefik باستخدام ملفي compose معاً
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**الخطوة 4: تحقق.**

```bash
# اختبار HTTPS (ينبغي أن يعيد 200 أو 302)
curl -I https://fanek.example.com
```

### الشهادات الموقّعة ذاتياً (النشر الداخلي على الشبكة المحلية)

إذا كان خادمك على شبكة داخلية بلا اتصال بالإنترنت، فلن يعمل Let's Encrypt لأنه لا يستطيع الوصول إلى خادمك للتحقق من النطاق. في هذه الحالة، استخدم شهادة موقّعة ذاتياً.

**توليد شهادة موقّعة ذاتياً:**

```bash
# توليد شهادة موقّعة ذاتياً صالحة لمدة 365 يوماً
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/fanek.key \
  -out /etc/ssl/certs/fanek.crt \
  -subj "/CN=fanek.company.local"
```

استبدل `fanek.company.local` باسم المضيف الداخلي لديك.

**الاستخدام مع Caddy.** استبدل محتوى ملف Caddyfile:

```
fanek.company.local {
    # استخدام الشهادة والمفتاح الموقّعين ذاتياً
    tls /etc/ssl/certs/fanek.crt /etc/ssl/private/fanek.key
    reverse_proxy localhost:8080
}
```

**الاستخدام مع Nginx.** أضف توجيهات SSL إلى كتلة server في `/etc/nginx/sites-available/fanek`:

```nginx
server {
    listen 443 ssl;
    server_name fanek.company.local;

    # مسارا الشهادة الموقّعة ذاتياً
    ssl_certificate /etc/ssl/certs/fanek.crt;
    ssl_certificate_key /etc/ssl/private/fanek.key;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**الاستخدام مع Traefik.** تتطلب الشهادات الموقّعة ذاتياً مع Traefik مزوّد ملفات، وهو أكثر تعقيداً. للنشر الداخلي مع Traefik، فكّر في استخدام Caddy أو Nginx كوكيل عكسي بدلاً منه.

> **ملاحظة:** ستعرض المتصفحات تحذيراً أمنياً للشهادات الموقّعة ذاتياً. على المستخدمين تجاوز التحذير أو تثبيت الشهادة كشهادة موثوقة على أجهزتهم. في المؤسسات، يسهّل توزيع الشهادة عبر سياسة المجموعة (ويندوز) أو أدوات إدارة التهيئة هذه المهمة.

### قائمة التحقق

بعد تهيئة الوكيل العكسي، تحقق مما يلي:

- [ ] افتح `https://fanek.example.com` في المتصفح.
- [ ] تأكد من ظهور أيقونة القفل (شهادة صالحة). مع الشهادات الموقّعة ذاتياً، ستحتاج إلى قبول التحذير أولاً.
- [ ] تأكد من أن `http://fanek.example.com` يعيد التوجيه إلى HTTPS تلقائياً.
- [ ] سجّل الدخول وتأكد من أن التطبيق يعمل بشكل طبيعي.


## 5. جدار الحماية وتقوية الأمان

### جدار الحماية للنشر عبر الإنترنت (UFW)

يأتي UFW (جدار الحماية غير المعقّد) مثبّتاً افتراضياً على أوبونتو. تسمح هذه القواعد بـ SSH وHTTP وHTTPS وتحجب ما عداها، بما في ذلك الوصول المباشر إلى منفذ فنك 8080.

```bash
# ضبط السياسات الافتراضية: رفض كل الوارد، والسماح بكل الصادر
sudo ufw default deny incoming
sudo ufw default allow outgoing

# السماح بـ SSH حتى لا تُغلق على نفسك الباب
sudo ufw allow OpenSSH

# السماح بـ HTTP وHTTPS للوكيل العكسي
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# حجب الوصول المباشر إلى منفذ فنك صراحةً
# يضمن هذا أن التطبيق لا يُوصل إليه إلا عبر الوكيل العكسي
sudo ufw deny 8080/tcp

# تفعيل جدار الحماية (اكتب 'y' عند السؤال)
sudo ufw enable

# التحقق من القواعد
sudo ufw status
```

### جدار الحماية للشبكة الداخلية

للخوادم على شبكة داخلية، قد ترغب في قصر الوصول عبر HTTPS على الشبكة الفرعية لمكتبك فقط:

```bash
# ضبط السياسات الافتراضية
sudo ufw default deny incoming
sudo ufw default allow outgoing

# السماح بـ SSH
sudo ufw allow OpenSSH

# السماح بـ HTTPS من الشبكة الفرعية للمكتب فقط (عدّل الشبكة الفرعية لتطابق شبكتك)
sudo ufw allow from 192.168.1.0/24 to any port 443

# تفعيل جدار الحماية
sudo ufw enable

# التحقق من القواعد
sudo ufw status
```

استبدل `192.168.1.0/24` بالشبكة الفرعية الفعلية لديك.

> **الدفاع المتعدد الطبقات:** حتى لو كان خادمك خلف جدار حماية مؤسسي أو في شبكة خاصة، يُنصح بتهيئة جدار حماية على مستوى المضيف. فإن أُسيئت تهيئة الجدار المحيطي أو جرى تجاوزه، وفّر جدار المضيف طبقة حماية إضافية.

### إجراءات تقوية إضافية

يُنصح بهذه الخطوات بشدة لأي خادم إنتاج.

**مصادقة SSH بالمفتاح فقط.** يمنع تعطيل تسجيل الدخول بكلمة المرور هجمات التخمين:

```bash
# تعطيل المصادقة بكلمة المرور في SSH
# تأكد من أن لديك وصولاً بمفتاح SSH قبل تنفيذ هذا
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

# إعادة تحميل خدمة SSH لتطبيق التغيير
sudo systemctl reload ssh
```

> **تحذير:** قبل تعطيل المصادقة بكلمة المرور، تأكد من قدرتك على تسجيل الدخول بمفتاح SSH. وإلا فستُغلق على نفسك الباب خارج خادمك.

**fail2ban.** يحظر تلقائياً عناوين IP التي تُظهر سلوكاً ضاراً (مثل تكرار محاولات تسجيل الدخول الفاشلة عبر SSH):

```bash
# تثبيت fail2ban
sudo apt install -y fail2ban

# تفعيل الخدمة وتشغيلها
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

يعمل fail2ban مباشرة بعد التثبيت مع SSH. يقرأ `/var/log/auth.log` ويحظر العناوين ذات محاولات الدخول الفاشلة الكثيرة.

**التحديثات الأمنية التلقائية.** أبقِ خادمك محدّثاً دون تدخل يدوي:

```bash
# تثبيت حزمة unattended-upgrades
sudo apt install -y unattended-upgrades

# تفعيل التحديثات الأمنية التلقائية (اختر "Yes" عند السؤال)
sudo dpkg-reconfigure -plow unattended-upgrades
```

لإرشادات تقوية أعمق، راجع [معايير CIS](https://www.cisecurity.org/cis-benchmarks) لأوبونتو ودبيان.


## 6. النسخ الاحتياطي

أهم ما ينبغي أخذ نسخة احتياطية منه هو قاعدة بيانات PostgreSQL. فهي تحتوي على كل بيانات فنك: العملاء، والخدمات، والمستخدمين، والإعدادات.

### النسخ الاحتياطي لقاعدة البيانات

**عمليات النشر عبر Docker:**

```bash
# تفريغ قاعدة البيانات في ملف مضغوط
docker exec fanek-db-1 pg_dump -U fanek -Fc fanek > /opt/backups/fanek-$(date +%Y%m%d).dump
```

**عمليات التثبيت المباشر:**

```bash
# تفريغ قاعدة البيانات في ملف مضغوط
pg_dump -U fanek -Fc fanek > /opt/backups/fanek-$(date +%Y%m%d).dump
```

> **ملاحظة عن اسم الحاوية:** اسم الحاوية `fanek-db-1` يفترض أن اسم مجلد المشروع هو `fanek`. إذا كان لمجلدك اسم آخر، يستخدم Docker Compose ذلك الاسم كبادئة. نفّذ `docker compose ps` لمعرفة اسم الحاوية الفعلي.

### نسخ احتياطي يومي تلقائي مع التدوير

هيّئ مهمة cron تأخذ نسخة احتياطية كل يوم في الساعة 2:00 صباحاً وتحذف النسخ الأقدم من 7 أيام:

```bash
# إنشاء مجلد النسخ الاحتياطية
sudo mkdir -p /opt/backups

# فتح crontab الخاص بالجذر للتحرير
sudo crontab -e
```

**لعمليات النشر عبر Docker،** أضف هذا السطر:

```
# نسخة احتياطية يومية لقاعدة البيانات في الساعة 2:00 صباحاً، مع الاحتفاظ بـ 7 أيام
0 2 * * * docker exec fanek-db-1 pg_dump -U fanek -Fc fanek > /opt/backups/fanek-$(date +\%Y\%m\%d).dump && find /opt/backups -name "fanek-*.dump" -mtime +7 -delete
```

**لعمليات التثبيت المباشر،** أضف هذا السطر:

```
# نسخة احتياطية يومية لقاعدة البيانات في الساعة 2:00 صباحاً، مع الاحتفاظ بـ 7 أيام
0 2 * * * pg_dump -U fanek -Fc fanek > /opt/backups/fanek-$(date +\%Y\%m\%d).dump && find /opt/backups -name "fanek-*.dump" -mtime +7 -delete
```

### استعادة قاعدة البيانات

**عمليات النشر عبر Docker:**

```bash
# استعادة نسخة احتياطية من قاعدة البيانات (استبدل اسم الملف باسم نسختك)
docker exec -i fanek-db-1 pg_restore -U fanek -d fanek --clean --if-exists < /opt/backups/fanek-YYYYMMDD.dump
```

**عمليات التثبيت المباشر:**

```bash
# استعادة نسخة احتياطية من قاعدة البيانات (استبدل اسم الملف باسم نسختك)
pg_restore -U fanek -d fanek --clean --if-exists /opt/backups/fanek-YYYYMMDD.dump
```

> **تحذير:** تستبدل الاستعادة كل البيانات الموجودة في قاعدة البيانات. اختبر عملية الاستعادة دائماً على نسخة منفصلة قبل الاعتماد عليها في التعافي من الكوارث.

### ملفات التطبيق

تطبيق فنك نفسه عديم الحالة. الشيفرة تأتي من مستودع Git ويمكن استنساخها من جديد في أي وقت. ما تحتاج للحفاظ عليه:

- **قاعدة البيانات** -- عبر إجراءات النسخ الاحتياطي أعلاه.
- **وحدة تخزين `data` في Docker** -- تحتوي على `NEXTAUTH_SECRET` المولّد تلقائياً. إذا فُقدت هذه الوحدة، فُقد المفتاح السري وأصبحت كل جلسات المستخدمين غير صالحة (سيحتاج المستخدمون لتسجيل الدخول من جديد). خذ نسخة احتياطية منها بالأمر: `docker cp fanek-app-1:/data /opt/backups/fanek-data/`
  > **ملاحظة عن اسم الحاوية:** اسم الحاوية `fanek-app-1` يفترض أن اسم مجلد المشروع هو `fanek`. إذا كان لمجلدك اسم آخر، يستخدم Docker Compose ذلك الاسم كبادئة. نفّذ `docker compose ps` لمعرفة اسم الحاوية الفعلي.
- **ملف `.env`** (في التثبيت المباشر) -- يحتوي على `NEXTAUTH_SECRET` وبيانات اعتماد قاعدة البيانات. أدرجه في نسختك الاحتياطية.

### النسخ الاحتياطي خارج الموقع

تحمي النسخ المحلية من الحذف العرضي وأخطاء التطبيق، لكنها لا تحمي من أعطال العتاد أو الكوارث. انسخ نسخك الاحتياطية إلى موقع منفصل:

```bash
# مثال: نسخ النسخ الاحتياطية إلى خادم بعيد عبر rsync
rsync -az /opt/backups/ backup-user@backup-server:/backups/fanek/

# مثال: الرفع إلى تخزين متوافق مع S3
aws s3 sync /opt/backups/ s3://your-bucket/fanek-backups/
```


## 7. التحديثات والترقيات

### قبل التحديث

1. **خذ نسخة احتياطية من قاعدة البيانات** باستخدام الأوامر في [القسم 6](#6-النسخ-الاحتياطي). احرص دائماً على وجود نسخة حديثة قبل الترقية.
2. **راجع ملف CHANGELOG** بحثاً عن تغييرات كاسرة. اقرأ ملاحظات الإصدار أو ملف CHANGELOG في المستودع قبل سحب الشيفرة الجديدة.

### التحديث عبر Docker

```bash
cd /opt/fanek

# سحب أحدث شيفرة
git pull

# إعادة بناء صورة الحاوية
docker compose build

# إعادة التشغيل بالصورة الجديدة (تشغّل نقطة الدخول الترحيلات تلقائياً)
docker compose up -d
```

إن كنت تستخدم إعداد Traefik من القسم 4، فأدرج ملف الإنتاج:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### التحديث في التثبيت المباشر

```bash
cd /opt/fanek

# سحب أحدث شيفرة
sudo -u fanek git pull

# تثبيت أي تبعيات جديدة أو محدّثة
sudo -u fanek npm ci

# تطبيق أي ترحيلات جديدة لقاعدة البيانات
sudo -u fanek npx prisma migrate deploy

# إعادة بناء تطبيق Next.js
sudo -u fanek npm run build

# إعادة تشغيل الخدمة لاستخدام البناء الجديد
sudo systemctl restart fanek
```

### التحقق بعد التحديث

```bash
# التحقق من استجابة التطبيق
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080

# مراجعة السجلات بحثاً عن أخطاء (Docker)
docker compose logs --tail 20 app

# مراجعة السجلات بحثاً عن أخطاء (التثبيت المباشر)
journalctl -u fanek --no-pager -n 20
```


## 8. استكشاف الأخطاء وإصلاحها

### التطبيق لا يبدأ

**الأعراض:** تتوقف حاوية التطبيق فور تشغيلها، أو تفشل خدمة systemd في البدء.

**التشخيص:**

```bash
# Docker: مراجعة سجلات الحاوية
docker compose logs --tail 100 app

# التثبيت المباشر: مراجعة سجلات الخدمة
journalctl -u fanek --no-pager -n 100
```

**الأسباب الشائعة وحلولها:**

- **`DATABASE_URL` خاطئ أو مفقود.** راجع ملف `.env`. في Docker، يُضبط `DATABASE_URL` في `docker-compose.yml` ولا ينبغي تجاوزه في `.env`. في التثبيت المباشر، تأكد من صحة اسم المستخدم وكلمة المرور والمضيف واسم قاعدة البيانات.
- **المنفذ 8080 مستخدم بالفعل.** هناك عملية أخرى تستمع على المنفذ نفسه. تحقق بالأمر `sudo lsof -i :8080` وأوقف العملية المتعارضة، أو غيّر منفذ فنك بضبط `PORT` في `.env`.
- **إصدار Node.js قديم جداً.** يتطلب فنك Node.js 20 أو أحدث. تحقق بالأمر `node --version`.

### خطأ 502 Bad Gateway

**الأعراض:** يعيد الوكيل العكسي صفحة خطأ "502 Bad Gateway".

**التشخيص:** الوكيل العكسي يعمل، لكنه لا يستطيع الوصول إلى فنك على `127.0.0.1:8080`.

```bash
# التحقق من أن التطبيق يستمع فعلاً على المنفذ 8080
curl -I http://127.0.0.1:8080

# Docker: التحقق من أن الحاوية تعمل
docker compose ps

# التثبيت المباشر: التحقق من حالة الخدمة
sudo systemctl status fanek
```

**الأسباب الشائعة وحلولها:**

- **التطبيق لا يعمل.** شغّله بالأمر `docker compose up -d` أو `sudo systemctl start fanek`.
- **التطبيق مربوط بمنفذ مختلف.** تأكد من أن إعداد `PORT` في `.env` يطابق تهيئة الوكيل العكسي.
- **ملف `docker-compose.override.yml` يربط بعنوان خاطئ.** يجب أن يصل الوكيل إلى `127.0.0.1:8080`. إذا كان ملف التجاوز يربط بعنوان آخر، فحدّثه.

### أخطاء شهادة SSL

**الأعراض:** يعرض المتصفح "اتصالك ليس خاصاً"، أو يفشل Certbot في الحصول على شهادة.

**التشخيص:**

```bash
# التحقق من أن المنفذ 80 مفتوح (يحتاجه Let's Encrypt لتحدي HTTP)
sudo ufw status | grep 80

# التحقق من قدرة Certbot على الوصول إلى خادمك
curl -I http://fanek.example.com
```

**الأسباب الشائعة وحلولها:**

- **DNS لم ينتشر بعد.** يجب أن يترجم Let's Encrypt نطاقك إلى عنوان IP الخاص بخادمك. انتظر الانتشار (تحقق بالأمر `dig +short fanek.example.com`) ثم أعد المحاولة.
- **المنفذ 80 محجوب.** يتطلب تحدي HTTP-01 في Let's Encrypt أن يكون المنفذ 80 مفتوحاً. تأكد من أن جدار الحماية وأي موجّه أو مجموعة أمان سحابية أعلى المسار يسمحون بالمنفذ 80.
- **خادم ويب آخر يستخدم المنفذ 80.** أوقفه أو هيّئه بحيث لا يتعارض. تحقق بالأمر `sudo lsof -i :80`.

### تعذّر الوصول من الأجهزة الأخرى

**الأعراض:** يعمل فنك على `https://localhost` داخل الخادم لكنه غير متاح من الأجهزة الأخرى على الشبكة أو من الإنترنت.

**التشخيص:**

```bash
# التحقق من أن جدار الحماية يسمح بالمنفذ 443
sudo ufw status

# التحقق من أن الوكيل العكسي يستمع على جميع الواجهات (لا على المضيف المحلي فقط)
sudo ss -tlnp | grep ':443'
```

**الأسباب الشائعة وحلولها:**

- **جدار الحماية يحجب المنفذ 443.** أضف قاعدة: `sudo ufw allow 443/tcp`.
- **مجموعة الأمان السحابية أو جدار حماية الشبكة.** إذا كان خادمك مستضافاً على AWS أو GCP أو Azure أو ما شابه، فراجع إعدادات جدار الحماية أو مجموعة الأمان لدى مزوّد السحابة. يجب السماح بالمنفذ 443 هناك أيضاً.
- **الوكيل العكسي يستمع على المضيف المحلي فقط.** تأكد من تهيئة الوكيل (Caddy أو Nginx أو Traefik) للاستماع على `0.0.0.0:443` لا على `127.0.0.1:443`.
- **DNS لا يشير إلى العنوان الصحيح.** تحقق بالأمر `dig +short fanek.example.com`.

### رفض الاتصال بقاعدة البيانات

**الأعراض:** تُظهر سجلات فنك أخطاء "connection refused" أو "could not connect to server".

**التشخيص:**

```bash
# Docker: التحقق من أن حاوية قاعدة البيانات تعمل
docker compose ps db

# التثبيت المباشر: التحقق من أن PostgreSQL يعمل
sudo systemctl status postgresql
```

**الأسباب الشائعة وحلولها:**

- **PostgreSQL لا يعمل.** شغّله بالأمر `docker compose up -d db` (في Docker) أو `sudo systemctl start postgresql` (في التثبيت المباشر).
- **بيانات اعتماد خاطئة.** تأكد من أن اسم المستخدم وكلمة المرور في `DATABASE_URL` يطابقان ما ضُبط عند إنشاء مستخدم قاعدة البيانات.
- **`pg_hba.conf` يرفض الاتصالات (في التثبيت المباشر فقط).** يستخدم PostgreSQL ملف `pg_hba.conf` للتحكم في المستخدمين الذين يمكنهم الاتصال وطريقة مصادقتهم. راجع الملف (عادة في `/etc/postgresql/16/main/pg_hba.conf`) وتأكد من وجود سطر يسمح للمستخدم `fanek` بالاتصال بقاعدة البيانات `fanek` بمصادقة كلمة المرور:

  ```
  # TYPE  DATABASE  USER  ADDRESS       METHOD
  local   fanek     fanek                md5
  host    fanek     fanek 127.0.0.1/32   md5
  ```

  بعد التعديل، أعد تحميل PostgreSQL: `sudo systemctl reload postgresql`.

### بطء الأداء

**الأعراض:** تستغرق الصفحات وقتاً طويلاً للتحميل، أو يتوقف الخادم عن الاستجابة تحت الاستخدام العادي.

**التشخيص:**

```bash
# مراجعة استهلاك المعالج والذاكرة
htop

# مراجعة استهلاك القرص
df -h

# Docker: مراجعة استهلاك موارد الحاويات
docker stats --no-stream
```

**الأسباب الشائعة وحلولها:**

- **ذاكرة غير كافية.** يحتاج فنك مع PostgreSQL إلى 1 غيغابايت من الذاكرة على الأقل. إذا كانت ذاكرة خادمك منخفضة، ففكّر في الترقية أو إضافة مساحة تبديل.
- **حد ذاكرة Node.js.** إذا نفدت ذاكرة التطبيق، فارفع الحد بإضافة هذا إلى ملف `.env`:

  ```
  NODE_OPTIONS=--max-old-space-size=512
  ```

  ثم أعد تشغيل التطبيق.
- **القرص ممتلئ.** تحقق بالأمر `df -h`. قد تكون النسخ الاحتياطية القديمة أو صور Docker أو ملفات السجلات هي ما يملأ القرص. نظّف بالأمر `docker system prune` (في Docker) أو احذف ملفات السجلات القديمة.
- **قاعدة البيانات تحتاج إلى تنظيف.** في النسخ التي تعمل لفترات طويلة، قد يحتاج PostgreSQL إلى صيانة. نفّذ: `docker exec fanek-db-1 psql -U fanek -c "VACUUM ANALYZE;"` (في Docker) أو `psql -U fanek -c "VACUUM ANALYZE;"` (في التثبيت المباشر).

## 9. المراقبة والتنبيهات

فنك مستضاف ذاتياً، لذا فالمراقبة من مسؤولية المشغّل -- أنت من يختار الأدوات التي تناسب بيئتك. يمنحك فنك اللبنتين الأساسيتين اللتين تحتاجهما: نقطة نهاية لفحص السلامة وسجلات مهيكلة.

### فحوصات السلامة

يوفّر فنك نقطة نهاية للتحقق من الحياة على `/api/health` تعيد `200` مع جسم JSON صغير (`{ "status": "ok", ... }`) عندما يكون التطبيق يعمل. استخدمها في:

- **تنسيق الحاويات** -- فحوصات السلامة والحياة في Docker أو Kubernetes (وجّهها إلى `/api/health`).
- **موازنات الحمل والوكلاء العكسيون** -- فحوصات سلامة الخوادم الخلفية قبل توجيه حركة المرور.
- **مراقبة الجاهزية** -- خدمة مراقبة خارجية (مثل UptimeRobot أو Healthchecks.io أو مسبار Prometheus blackbox) تستعلم عن الرابط كل دقيقة.

```bash
# فحص يدوي سريع
curl -fsS http://localhost:8080/api/health && echo OK
```

### السجلات المهيكلة

يسجّل فنك بصيغة JSON مهيكلة (عبر Pino)، مع إخفاء الحقول الحساسة. مرّر هذه السجلات إلى أداة التجميع التي تختارها -- Grafana Loki، أو مكدس ELK/OpenSearch، أو Datadog، أو CloudWatch، وغيرها -- بجمع مخرجات الحاوية القياسية (في Docker) أو سجل systemd (في التثبيت المباشر).

```bash
# Docker: متابعة السجلات
docker compose logs -f app

# التثبيت المباشر (systemd): متابعة السجلات
journalctl -u fanek -f
```

### ما الذي ينبغي التنبيه عليه

كحد أدنى، هيّئ تنبيهات لما يلي:

- **فشل فحوصات السلامة** -- استجابة غير 200 من `/api/health` أو تعذّر الوصول إليها في عدد متتالٍ من الفحوص (الخدمة متوقفة).
- **ارتفاع سجلات مستوى الخطأ** -- زيادة مستمرة في أسطر السجل ذات `level: 50` (خطأ).
- **معدل استجابات HTTP 5xx** -- ارتفاع أخطاء الخادم عند الوكيل العكسي.
- **موارد المضيف** -- استهلاك القرص (تملأ النسخ الاحتياطية والصور والسجلات القرص مع الوقت -- راجع قسم استكشاف الأخطاء)، والذاكرة، وتشبّع المعالج.
- **قاعدة البيانات** -- فشل الاتصالات واستهلاك القرص على وحدة تخزين PostgreSQL.

### اختياري: خدمة تتبّع الأخطاء

إن أردت تتبّعاً مجمّعاً للاستثناءات مع تتبّع المكدس، فبإمكانك دمج خدمة لتتبّع الأخطاء (مثل Sentry أو GlitchTip أو Bugsnag) على مستوى البنية التحتية. لا يأتي فنك بواحدة مدمجة -- يبقي هذا التطبيق خالياً من قياس الأداء الخارجي افتراضياً، ويترك لك اختيار حل مستضاف ذاتياً أو سحابي يلبي متطلبات إقامة البيانات لديك.
