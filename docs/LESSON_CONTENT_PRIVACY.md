# Lesson Content Privacy Policy

Official Gomdory lesson templates, starter code, sample cards, and activity examples must avoid student personal information.

## Required rule

Student-facing official examples must not ask for, display, or encourage entry of:

- student real name
- school name
- phone number
- address
- email
- birth date
- resident number or national ID
- parent contact
- exact location
- medical information
- sensitive identity attributes

## Preferred safe examples

Use fictional, non-identifying data such as:

- nicknames: `탐험가`, `학생 A`, `코딩 고양이`
- fictional class/team names: `AI 탐험대`
- fictional object names
- game scores
- weather-like sample values
- favorite color, animal, or food only when not linked to identity
- made-up non-personal examples

## Official template guidance

- Starter templates must not ask for names, schools, phone numbers, addresses, or emails.
- Python `input()` prompts should use privacy-safe wording such as `닉네임을 입력하세요`, `관심 있는 AI 사례를 입력하세요`, or `게임 점수를 입력하세요`.
- Web Studio examples should use fictional situations and objects rather than personal profiles.
- AI Bingo and AI Judgment Sort examples should ask for reasons, observations, and non-personal examples only.
- Teacher-created content can exist, but official starter templates and seed examples must remain privacy-safe.


## Python Studio Lite starter-content requirements

The official Python Studio Lite starter must continue to use privacy-safe prompts such as `닉네임을 입력하세요` and `관심 있는 AI 사례를 입력하세요`. Lesson 1's starter should model `print()`, `input()`, variables, and f-string with non-identifying examples such as `탐험가`, `영상 추천`, and `AI 탐험 카드`. It must not ask for real names, schools, phone numbers, addresses, emails, birth dates, student IDs, or `010` phone-number examples. Runtime availability does not change this rule: even when Pyodide fails or is blocked, students can save/submit the same privacy-safe starter and their edited code without server-side execution.

## Guardrail test scope

Static privacy tests scan official lesson/activity starter content and fail when banned personal-info prompts appear in official templates. Policy documentation may mention restricted terms for explanation, but production starter content must not use them. Lesson 1 AI Bingo uses only the final 1차시 non-personal AI examples, and Python Studio Lite remains browser-only with no server-side Python execution.

## Lesson 2 AI judgment and Python starter requirements

Lesson 2 official content must stay Python-focused and privacy-safe. The AI Judgment Sort counseling card is a fictional scenario about `힘든 마음을 털어놓은 사람`; it must not ask students to disclose their own mental health, real identity, school, phone number, address, email, birth date, student ID, or other sensitive personal data.

The Lesson 2 Python Studio Lite starter may ask for `판단할 일`, whether the work has `데이터가 많고 반복되는 일`, and whether `감정, 책임, 윤리 판단` is important. It should model `input()`, variables, `if/elif/else`, `and/or`, comparison operators, indentation, and f-string output. It must remain browser-side only: no server-side Python execution and no package installation.

## Institutional public messaging alignment (2026-05-19)
- Institutional pages must keep 개인정보 최소화 원칙 language and avoid official-certification claims.
