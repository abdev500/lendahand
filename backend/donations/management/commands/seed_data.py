import random
from io import BytesIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management.base import BaseCommand
from PIL import Image

from donations.models import Campaign, CampaignMedia, News, NewsMedia

User = get_user_model()

# Get the directory where this script is located
BASE_DIR = Path(__file__).resolve().parent
SEED_IMAGES_DIR = BASE_DIR / "seed_images"


class Command(BaseCommand):
    help = "Seed database with sample data"

    def handle(self, *args, **options):
        # Create test users
        admin_user, _ = User.objects.get_or_create(
            email="admin@lendahand.me",
            defaults={
                "username": "admin_seed",
                "is_staff": True,
                "is_superuser": True,
                "is_moderator": True,
            },
        )
        # Also update existing admin user if it exists with different email
        if not admin_user.is_moderator:
            admin_user.is_moderator = True
            admin_user.save()
        admin_user.set_password("admin")
        admin_user.save()

        regular_user, _ = User.objects.get_or_create(
            email="user@example.com",
            defaults={
                "username": "testuser",
                "is_staff": False,
                "is_moderator": False,
            },
        )
        regular_user.set_password("password")
        regular_user.save()

        moderator_user, _ = User.objects.get_or_create(
            email="moderator@lendahand.me",
            defaults={
                "username": "moderator",
                "is_staff": False,
                "is_moderator": True,
            },
        )
        moderator_user.set_password("moderator")
        moderator_user.save()

        # Sample campaign data
        campaigns_data = [
            {
                "title": "Support for Belarusian Families",
                "short_description": "Helping families affected by political unrest in Belarus",
                "description": "<p>This campaign aims to provide financial assistance to families who have been affected by the ongoing political situation in Belarus. Your donations will help cover basic needs such as food, housing, and medical expenses.</p><p>We work directly with local organizations to ensure that funds reach those who need it most.</p>",
                "target_amount": 50000,
                "status": "approved",
                "created_by": regular_user,
            },
            {
                "title": "Ukrainian Refugee Relief Fund",
                "short_description": "Emergency support for Ukrainian refugees",
                "description": "<p>As the conflict continues, millions of Ukrainians have been displaced. This fund provides immediate relief for refugees including housing, food, and essential supplies.</p>",
                "target_amount": 100000,
                "status": "approved",
                "created_by": regular_user,
            },
            {
                "title": "Medical Equipment for Hospitals",
                "short_description": "Supporting healthcare facilities with critical equipment",
                "description": "<p>Hospitals in affected regions are in urgent need of medical equipment. Your donation helps purchase vital supplies.</p>",
                "target_amount": 75000,
                "status": "pending",
                "created_by": regular_user,
            },
            {
                "title": "Education Support Program",
                "short_description": "Ensuring children continue their education",
                "description": "<p>Many children have been forced to leave their schools. This program provides educational materials and support for displaced students.</p>",
                "target_amount": 30000,
                "status": "approved",
                "created_by": moderator_user,
            },
            {
                "title": "Emergency Food Distribution",
                "short_description": "Providing meals to those in need",
                "description": "<p>Food security is critical. This campaign supports food distribution centers in affected areas.</p>",
                "target_amount": 40000,
                "status": "approved",
                "created_by": regular_user,
            },
            {
                "title": "Mental Health Support",
                "short_description": "Counseling and psychological support services",
                "description": "<p>Trauma counseling is essential for those affected by conflict and displacement. This fund supports mental health professionals.</p>",
                "target_amount": 25000,
                "status": "rejected",
                "created_by": regular_user,
            },
            {
                "title": "Winter Clothing Drive",
                "short_description": "Warm clothing for those facing harsh winters",
                "description": "<p>Winter can be particularly difficult for displaced families. This campaign provides warm clothing and blankets.</p>",
                "target_amount": 20000,
                "status": "approved",
                "created_by": regular_user,
            },
            {
                "title": "Children's Safety Fund",
                "short_description": "Protecting the most vulnerable",
                "description": "<p>Children need safe spaces and protection. This fund supports child protection programs.</p>",
                "target_amount": 35000,
                "status": "draft",
                "created_by": regular_user,
            },
            {
                "title": "Legal Aid Services",
                "short_description": "Legal support for refugees",
                "description": "<p>Legal documentation and aid services are crucial for refugees navigating new systems.</p>",
                "target_amount": 28000,
                "status": "approved",
                "created_by": moderator_user,
            },
            {
                "title": "Transportation Assistance",
                "short_description": "Helping people reach safety",
                "description": "<p>Transportation costs can be a barrier to safety. This fund covers travel expenses for those in need.</p>",
                "target_amount": 15000,
                "status": "pending",
                "created_by": regular_user,
            },
        ]

        # Image mapping for different campaign types
        image_categories = {
            "Support for Belarusian Families": [
                "humanitarian_1.jpg",
                "humanitarian_2.jpg",
                "humanitarian_3.jpg",
                "humanitarian_4.jpg",
                "support_1.jpg",
                "support_2.jpg",
            ],
            "Ukrainian Refugee Relief Fund": [
                "refugee_1.jpg",
                "refugee_2.jpg",
                "refugee_3.jpg",
                "refugee_4.jpg",
            ],
            "Medical Equipment for Hospitals": [
                "medical_1.jpg",
                "medical_2.jpg",
                "medical_3.jpg",
                "medical_4.jpg",
            ],
            "Education Support Program": [
                "education_1.jpg",
                "education_2.jpg",
                "education_3.jpg",
                "education_4.jpg",
            ],
            "Emergency Food Distribution": [
                "food_1.jpg",
                "food_2.jpg",
                "food_3.jpg",
                "food_4.jpg",
            ],
            "Mental Health Support": [
                "support_1.jpg",
                "support_2.jpg",
                "support_3.jpg",
                "support_4.jpg",
            ],
            "Winter Clothing Drive": [
                "humanitarian_3.jpg",
                "humanitarian_4.jpg",
                "support_3.jpg",
                "support_4.jpg",
            ],
            "Children's Safety Fund": [
                "support_1.jpg",
                "support_2.jpg",
                "support_3.jpg",
                "humanitarian_1.jpg",
            ],
            "Legal Aid Services": [
                "support_2.jpg",
                "support_3.jpg",
                "humanitarian_2.jpg",
                "humanitarian_3.jpg",
            ],
            "Transportation Assistance": [
                "refugee_2.jpg",
                "refugee_3.jpg",
                "support_1.jpg",
                "support_4.jpg",
            ],
        }

        # Create campaigns
        for idx, campaign_data in enumerate(campaigns_data):
            campaign, created = Campaign.objects.get_or_create(title=campaign_data["title"], defaults=campaign_data)

            # Get appropriate images for this campaign
            campaign_title = campaign_data["title"]
            image_list = image_categories.get(
                campaign_title,
                [
                    "humanitarian_1.jpg",
                    "humanitarian_2.jpg",
                    "humanitarian_3.jpg",
                    "support_1.jpg",
                ],
            )

            # Check if campaign already has media, if not add some
            existing_media_count = campaign.media.count()

            if created or existing_media_count < 3:
                # Select 3-4 random images for this campaign
                num_images = random.randint(3, 4)
                # Ensure we have enough images available
                available_images = min(num_images, len(image_list))
                selected_images = random.sample(image_list, available_images)

                # Create media entries for each image
                # Start from existing media count to avoid duplicate orders
                start_order = existing_media_count
                for idx, image_filename in enumerate(selected_images):
                    order = start_order + idx
                    image_path = SEED_IMAGES_DIR / image_filename

                    if image_path.exists():
                        with open(image_path, "rb") as img_file:
                            media = CampaignMedia(
                                campaign=campaign,
                                media_type="image",
                                file=File(
                                    img_file,
                                    name=f"{campaign.id}_{order}_{image_filename}",
                                ),
                                order=order,
                            )
                            media.save()
                    else:
                        # Fallback: create a simple colored image if file doesn't exist
                        self.stdout.write(self.style.WARNING(f"Image not found: {image_filename}, using placeholder"))
                        img = Image.new("RGB", (800, 600), color=(214, 40, 40))
                        img_io = BytesIO()
                        img.save(img_io, format="JPEG")
                        img_io.seek(0)

                        media = CampaignMedia(
                            campaign=campaign,
                            media_type="image",
                            file=File(img_io, name=f"campaign_{campaign.id}_image_{order}.jpg"),
                            order=order,
                        )
                        media.save()

                action = "Created" if created else "Updated"
                self.stdout.write(
                    self.style.SUCCESS(f"{action} campaign: {campaign.title} with {len(selected_images)} images")
                )

        # Sample news data with translations for all languages
        news_entries = [
            {
                "title_en": "Lend a Hand Platform Launch",
                "content_en": "<p>We are excited to announce the launch of our new donation platform, Lend a Hand! Our mission is to connect donors with those in need and make a real difference in our communities.</p><p>The platform features campaigns for humanitarian aid, refugee support, medical assistance, and educational programs.</p><p>Join us in making the world a better place, one donation at a time.</p>",
                "title_ru": "Запуск платформы Помощь",
                "content_ru": "<p>Мы рады объявить о запуске нашей новой платформы для пожертвований Помощь! Наша миссия - связать доноров с теми, кто в этом нуждается, и изменить ситуацию в наших сообществах.</p><p>Платформа включает кампании по гуманитарной помощи, поддержке беженцев, медицинской помощи и образовательным программам.</p><p>Присоединяйтесь к нам, чтобы сделать мир лучше, одно пожертвование за раз.</p>",
                "title_be": "Запуск платформы Дапамога",
                "content_be": "<p>Мы рады абвясціць аб запуску нашай новай платформы для ахвяраванняў Дапамога! Наша місія - звязаць данатараў з тымі, хто ў гэтым мае патрэбу, і змяніць сітуацыю ў нашых супольнасцях.</p><p>Платформа ўключае кампаніі па гуманітарнай дапамозе, падтрымцы бежанцаў, медыцынскай дапамозе і адукацыйных праграмах.</p><p>Далучайцеся да нас, каб зрабіць свет лепшым, адно ахвяраванне за разам.</p>",
                "title_lt": "Padėk Ranką Platformos Paleidimas",
                "content_lt": "<p>Džiaugiamės paskelbdami apie naujos aukų platformos Padėk Ranką paleidimą! Mūsų tikslas - sujungti remėjus su tais, kuriems reikia pagalbos, ir padaryti skirtumą mūsų bendruomenėse.</p><p>Platforma apima kampanijas humanitarinei pagalbai, pabėgėlių paramai, medicininei pagalbai ir švietimo programoms.</p><p>Prisijunkite prie mūsų, kad kartu padarytume pasaulį geresnį, viena auka vienu metu.</p>",
                "title_uk": "Запуск платформи Допомога",
                "content_uk": "<p>Ми раді оголосити про запуск нашої нової платформи для пожертвувань Допомога! Наша місія - зв'язати донорів з тими, хто в цьому потребує, і змінити ситуацію в наших спільнотах.</p><p>Платформа включає кампанії з гуманітарної допомоги, підтримки біженців, медичної допомоги та освітніх програм.</p><p>Приєднуйтеся до нас, щоб зробити світ кращим, одне пожертвування за раз.</p>",
                "published": True,
                "images": ["humanitarian_1.jpg", "humanitarian_2.jpg", "support_1.jpg"],
            },
            {
                "title_en": "Impact Report 2024: Making a Difference",
                "content_en": "<p>We're proud to share our 2024 Impact Report, showcasing the incredible difference your donations have made this year.</p><p><strong>Key achievements:</strong></p><ul><li>Over $500,000 raised across all campaigns</li><li>Supported more than 5,000 families</li><li>Provided medical aid to 2,000+ individuals</li><li>Helped 1,500 children continue their education</li></ul><p>Thank you to all our donors for their generosity and support. Together, we are changing lives.</p>",
                "title_ru": "Отчет о влиянии 2024: Изменяя ситуацию",
                "content_ru": "<p>Мы гордимся тем, что можем поделиться нашим Отчетом о влиянии 2024, демонстрируя невероятную разницу, которую ваши пожертвования внесли в этом году.</p><p><strong>Ключевые достижения:</strong></p><ul><li>Более $500,000 собрано по всем кампаниям</li><li>Поддержано более 5,000 семей</li><li>Оказана медицинская помощь более 2,000 людям</li><li>Помогли 1,500 детям продолжить обучение</li></ul><p>Спасибо всем нашим донорам за их щедрость и поддержку. Вместе мы меняем жизни.</p>",
                "title_be": "Справаздача пра ўплыў 2024: Рабім розніцу",
                "content_be": "<p>Мы ганарымся тым, што можам падзяліцца нашай Справаздачай пра ўплыў 2024, дэманструючы неверагодную розніцу, якую вашы ахвяраванні ўнеслі ў гэтым годзе.</p><p><strong>Ключавыя дасягненні:</strong></p><ul><li>Болей за $500,000 сабрана па ўсіх кампаніях</li><li>Падтрымана больш за 5,000 сем'яў</li><li>Аказана медыцынская дапамога больш чым 2,000 людзям</li><li>Дапамаглі 1,500 дзецям працягнуць адукацыю</li></ul><p>Дзякуй усім нашым данатарам за іх шчодрасць і падтрымку. Разам мы мяняем жыцці.</p>",
                "title_lt": "2024 Veiklos Ataskaita: Darant Skirtumą",
                "content_lt": "<p>Didžiuojamės galėdami pasidalyti savo 2024 Veiklos Ataskaita, rodančia nuostabų skirtumą, kurį jūsų aukos padarė šiais metais.</p><p><strong>Pagrindiniai pasiekimai:</strong></p><ul><li>Per $500,000 surinkta visose kampanijose</li><li>Parama suteikta daugiau nei 5,000 šeimų</li><li>Medicininė pagalba suteikta daugiau nei 2,000 asmenų</li><li>Padėta 1,500 vaikų tęsti mokslą</li></ul><p>Ačiū visiems mūsų remėjams už jų dosnumą ir paramą. Kartu mes keičiame gyvenimus.</p>",
                "title_uk": "Звіт про вплив 2024: Робимо різницю",
                "content_uk": "<p>Ми пишаємося тим, що можемо поділитися нашим Звітом про вплив 2024, демонструючи неймовірну різницю, яку ваші пожертвування внесли цього року.</p><p><strong>Ключові досягнення:</strong></p><ul><li>Понад $500,000 зібрано по всіх кампаніях</li><li>Підтримано понад 5,000 сімей</li><li>Надано медичну допомогу більш ніж 2,000 осіб</li><li>Допомогли 1,500 дітям продовжити навчання</li></ul><p>Дякуємо всім нашим донорам за їхню щедрість і підтримку. Разом ми змінюємо життя.</p>",
                "published": True,
                "images": [
                    "support_1.jpg",
                    "support_2.jpg",
                    "humanitarian_3.jpg",
                    "humanitarian_4.jpg",
                ],
            },
            {
                "title_en": "New Humanitarian Aid Campaign Launched",
                "content_en": "<p>We're excited to announce the launch of our newest humanitarian aid campaign, focused on providing essential supplies to families in need.</p><p>This campaign will distribute food packages, hygiene kits, and warm clothing to displaced families during the winter months.</p><p>Your donation of just $25 can provide a family with essential supplies for one week.</p><p>Every contribution counts - together we can make a real difference.</p>",
                "title_ru": "Запущена новая кампания по гуманитарной помощи",
                "content_ru": "<p>Мы рады объявить о запуске нашей новейшей кампании по гуманитарной помощи, направленной на предоставление основных товаров нуждающимся семьям.</p><p>Эта кампания будет распространять продовольственные пакеты, наборы гигиены и теплую одежду среди перемещенных семей в зимние месяцы.</p><p>Ваше пожертвование всего в $25 может обеспечить семью основными товарами на одну неделю.</p><p>Каждый вклад имеет значение - вместе мы можем изменить ситуацию.</p>",
                "title_be": "Запущена новая кампанія па гуманітарнай дапамозе",
                "content_be": "<p>Мы рады абвясціць аб запуску нашай найноўшай кампаніі па гуманітарнай дапамозе, накіраванай на прадастаўленне асноўных тавараў сем'ям, якія маюць патрэбу.</p><p>Гэтая кампанія будзе распаўсюджваць харчовыя пакеты, наборы гігіены і цёплую вопратку сярод перамешчаных сем'яў у зімовыя месяцы.</p><p>Ваша ахвяраванне ўсяго ў $25 можа забяспечыць сям'ю асноўнымі таварамі на адну тыдзень.</p><p>Кожны ўклад мае значэнне - разам мы можам змяніць сітуацыю.</p>",
                "title_lt": "Paleista Nauja Humanitarinės Pagalbos Kampanija",
                "content_lt": "<p>Džiaugiamės paskelbdami apie naujausios humanitarinės pagalbos kampanijos paleidimą, orientuotą į būtiniausių prekių teikimą šeimoms, kurioms reikia pagalbos.</p><p>Ši kampanija paskirstys maisto pakuotes, higienos rinkinius ir šiltus drabužius ištremtoms šeimoms žiemos mėnesiais.</p><p>Jūsų 25 USD auka gali aprūpinti šeimą būtiniausiomis prekėmis vienai savaitę.</p><p>Kiekvienas indėlis svarbus - kartu galime padaryti tikrą skirtumą.</p>",
                "title_uk": "Запущено нову кампанію з гуманітарної допомоги",
                "content_uk": "<p>Ми раді оголосити про запуск нашої найновішої кампанії з гуманітарної допомоги, спрямованої на надання основних товарів сім'ям, які потребують допомоги.</p><p>Ця кампанія розповсюджуватиме продовольчі пакети, набори гігієни та теплий одяг серед переміщених сімей у зимові місяці.</p><p>Ваше пожертвування всього лише $25 може забезпечити сім'ю основними товарами на один тиждень.</p><p>Кожен внесок має значення - разом ми можемо змінити ситуацію.</p>",
                "published": True,
                "images": ["food_1.jpg", "food_2.jpg", "humanitarian_2.jpg"],
            },
            {
                "title_en": "Education Support Program Reaches Milestone",
                "content_en": "<p>Our Education Support Program has reached an incredible milestone - we've now helped over 1,500 children continue their education despite displacement.</p><p>The program provides educational materials, books, school supplies, and online learning resources to children who have been forced to leave their schools.</p><p>Education is a fundamental right, and your donations ensure that children don't lose their chance to learn and grow.</p><p>Thank you to everyone who has supported this important initiative!</p>",
                "title_ru": "Программа поддержки образования достигла важной вехи",
                "content_ru": "<p>Наша программа поддержки образования достигла невероятной вехи - мы помогли более 1,500 детям продолжить обучение, несмотря на перемещение.</p><p>Программа предоставляет учебные материалы, книги, школьные принадлежности и онлайн-ресурсы для обучения детям, которые были вынуждены покинуть свои школы.</p><p>Образование - это основное право, и ваши пожертвования гарантируют, что дети не потеряют свой шанс учиться и расти.</p><p>Спасибо всем, кто поддержал эту важную инициативу!</p>",
                "title_be": "Праграма падтрымкі адукацыі дасягнула важнай вехі",
                "content_be": "<p>Наша праграма падтрымкі адукацыі дасягнула неверагоднай вехі - мы дапамаглі больш за 1,500 дзецям працягнуць адукацыю, нягледзячы на перамяшчэнне.</p><p>Праграма прадастаўляе навучальныя матэрыялы, кнігі, школьныя прыналежнасці і анлайн-рэсурсы для навучання дзецям, якія былі вымушаны пакінуць свае школы.</p><p>Адукацыя - гэта асноўнае права, і вашы ахвяраванні гарантуюць, што дзеці не страцяць свой шанс вучыцца і расці.</p><p>Дзякуй усім, хто падтрымаў гэтую важную ініцыятыву!</p>",
                "title_lt": "Švietimo Paramos Programa Pasiekė Svarbų Etapą",
                "content_lt": "<p>Mūsų Švietimo Paramos Programa pasiekė neįtikėtiną etapą - mes padėjome daugiau nei 1,500 vaikų tęsti mokslą nepaisant ištvėrimo.</p><p>Programa teikia švietimo medžiagą, knygas, mokyklos reikmenis ir internetinius mokymosi išteklius vaikams, kurie buvo priversti palikti savo mokyklas.</p><p>Švietimas yra pagrindinė teisė, ir jūsų aukos užtikrina, kad vaikai nepraras savo galimybės mokytis ir augti.</p><p>Ačiū visiems, kurie palaikė šią svarbią iniciatyvą!</p>",
                "title_uk": "Програма підтримки освіти досягла важливої віхи",
                "content_uk": "<p>Наша програма підтримки освіти досягла неймовірної віхи - ми допомогли більш ніж 1,500 дітям продовжити навчання, незважаючи на переміщення.</p><p>Програма надає навчальні матеріали, книги, шкільні приналежності та онлайн-ресурси для навчання дітям, які були змушені залишити свої школи.</p><p>Освіта - це основне право, і ваші пожертвування гарантують, що діти не втратять свій шанс вчитися і рости.</p><p>Дякуємо всім, хто підтримав цю важливу ініціативу!</p>",
                "published": True,
                "images": [
                    "education_1.jpg",
                    "education_2.jpg",
                    "education_3.jpg",
                    "education_4.jpg",
                ],
            },
            {
                "title_en": "Winter Aid Campaign: Providing Warmth and Hope",
                "content_en": "<p>As winter approaches, we're launching our annual Winter Aid Campaign to provide warmth and hope to families in need.</p><p>This campaign focuses on distributing winter clothing, blankets, heaters, and emergency shelter to those who need it most.</p><p>The harsh winter months can be particularly challenging for displaced families. Your support can make all the difference.</p><p>Help us ensure that every family has access to warmth and safety this winter.</p>",
                "title_ru": "Зимняя кампания помощи: Обеспечивая тепло и надежду",
                "content_ru": "<p>По мере приближения зимы мы запускаем нашу ежегодную Зимнюю кампанию помощи, чтобы обеспечить теплом и надеждой нуждающиеся семьи.</p><p>Эта кампания направлена на распределение зимней одежды, одеял, обогревателей и временных убежищ среди тех, кому это больше всего нужно.</p><p>Суровые зимние месяцы могут быть особенно трудными для перемещенных семей. Ваша поддержка может изменить все.</p><p>Помогите нам обеспечить каждой семье доступ к теплу и безопасности этой зимой.</p>",
                "title_be": "Зімовая кампанія дапамогі: Забяспечваючы цяпло і надзею",
                "content_be": "<p>З набліжэннем зімы мы запускаем нашу штогадовую Зімовую кампанію дапамогі, каб забяспечыць цяплом і надзеяй сем'і, якія маюць патрэбу.</p><p>Гэтая кампанія накіравана на размеркаванне зімовай вопраткі, коўдраў, абагравальнікаў і часовага прытулку сярод тых, каму гэта больш за ўсё патрэбна.</p><p>Суровыя зімовыя месяцы могуць быць асабліва цяжкімі для перамешчаных сем'яў. Ваша падтрымка можа змяніць усё.</p><p>Дапамажыце нам забяспечыць кожнай сям'і доступ да цяпла і бяспекі гэтай зімой.</p>",
                "title_lt": "Žiemos Pagalbos Kampanija: Suteikiant Šilumą ir Viltį",
                "content_lt": "<p>Artėjant žiemai, mes pradedame kasmetinę Žiemos Pagalbos Kampaniją, siekdami suteikti šilumą ir vilties šeimoms, kurioms reikia pagalbos.</p><p>Ši kampanija orientuota į žiemos drabužių, antklodžių, šildytuvų ir skubiųjų pastogių paskirstymą tiems, kuriems to labiausiai reikia.</p><p>Šalti žiemos mėnesiai gali būti ypač sudėtingi ištremtoms šeimoms. Jūsų parama gali viską pakeisti.</p><p>Padėkite mums užtikrinti, kad kiekviena šeima šią žiemą turėtų prieigą prie šilumos ir saugumo.</p>",
                "title_uk": "Зимова кампанія допомоги: Забезпечуючи тепло і надію",
                "content_uk": "<p>З наближенням зими ми запускаємо нашу щорічну Зимову кампанію допомоги, щоб забезпечити теплом і надією сім'ї, які потребують допомоги.</p><p>Ця кампанія спрямована на розподіл зимового одягу, ковдр, обігрівачів та тимчасових притулків серед тих, кому це найбільше потрібно.</p><p>Суворі зимові місяці можуть бути особливо складними для переміщених сімей. Ваша підтримка може все змінити.</p><p>Допоможіть нам забезпечити кожній сім'ї доступ до тепла та безпеки цієї зими.</p>",
                "published": True,
                "images": ["humanitarian_3.jpg", "humanitarian_4.jpg", "support_3.jpg"],
            },
        ]

        # Image mapping for news articles (can reuse campaign images)
        news_image_categories = {
            "Lend a Hand Platform Launch": [
                "humanitarian_1.jpg",
                "humanitarian_2.jpg",
                "support_1.jpg",
            ],
            "Impact Report 2024: Making a Difference": [
                "support_1.jpg",
                "support_2.jpg",
                "humanitarian_3.jpg",
                "humanitarian_4.jpg",
            ],
            "New Humanitarian Aid Campaign Launched": [
                "food_1.jpg",
                "food_2.jpg",
                "humanitarian_2.jpg",
            ],
            "Education Support Program Reaches Milestone": [
                "education_1.jpg",
                "education_2.jpg",
                "education_3.jpg",
                "education_4.jpg",
            ],
            "Winter Aid Campaign: Providing Warmth and Hope": [
                "humanitarian_3.jpg",
                "humanitarian_4.jpg",
                "support_3.jpg",
            ],
        }

        # Create news entries
        for news_data in news_entries:
            # Get English title for matching
            title_en = news_data["title_en"]
            content_en = news_data.get("content_en", "")
            news, created = News.objects.get_or_create(
                title=title_en,
                defaults={
                    "content": content_en,
                    "published": news_data.get("published", True),
                },
            )

            # Update if news exists but content is different
            if not created:
                if news.content != content_en or news.title != title_en:
                    news.title = title_en
                    news.content = content_en
                    news.published = news_data.get("published", True)
                    news.save()

            # Add images to news
            existing_media_count = news.media.count()
            selected_images = []
            if created or existing_media_count == 0:
                # Get images for this news article
                image_list = news_data.get(
                    "images",
                    news_image_categories.get(
                        title_en,
                        ["humanitarian_1.jpg", "humanitarian_2.jpg", "support_1.jpg"],
                    ),
                )

                # Select images (use all provided or random sample)
                selected_images = image_list[: min(len(image_list), 4)]  # Max 4 images for news

                # Create NewsMedia entries for each image
                for idx, image_filename in enumerate(selected_images):
                    image_path = SEED_IMAGES_DIR / image_filename

                    if image_path.exists():
                        with open(image_path, "rb") as img_file:
                            news_media = NewsMedia(
                                news=news,
                                media_type="image",
                                file=File(
                                    img_file,
                                    name=f"news_{news.id}_{idx}_{image_filename}",
                                ),
                                order=idx,
                            )
                            news_media.save()
                    else:
                        # Fallback: create a simple colored image if file doesn't exist
                        self.stdout.write(self.style.WARNING(f"Image not found: {image_filename}, using placeholder"))
                        img = Image.new("RGB", (800, 600), color=(214, 40, 40))
                        img_io = BytesIO()
                        img.save(img_io, format="JPEG")
                        img_io.seek(0)

                        news_media = NewsMedia(
                            news=news,
                            media_type="image",
                            file=File(img_io, name=f"news_{news.id}_image_{idx}.jpg"),
                            order=idx,
                        )
                        news_media.save()

            action = "Created" if created else "Updated"
            images_info = f" with {len(selected_images)} images" if selected_images else ""
            self.stdout.write(self.style.SUCCESS(f"{action} news: {title_en}{images_info}"))

        self.stdout.write(self.style.SUCCESS("Successfully seeded database!"))
