// Jenkinsfile (repo root). Windows Jenkins agent, Docker Desktop in Linux containers mode.
// Plugins: Pipeline, Credentials Binding, Workspace Cleanup, Git.
// Credential: "student-performance-env" (Secret file = copy of the root .env).

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 60, unit: 'MINUTES')
  }

  environment {
    COMPOSE_PROJECT_NAME = 'student-performance'
  }

  stages {
    stage('Test') {
      parallel {
        stage('auth-service') {
          steps {
            bat 'docker run --rm -v "%WORKSPACE%\\auth-service:/src:ro" node:22-alpine sh -c "mkdir /work && cp -r /src/. /work && cd /work && npm install --no-audit --no-fund && npm test"'
          }
        }

        stage('data-service') {
          steps {
            bat 'docker run --rm -v "%WORKSPACE%\\data-service:/src:ro" node:22-alpine sh -c "mkdir /work && cp -r /src/. /work && cd /work && npm install --no-audit --no-fund && npm test"'
          }
        }

        stage('frontend-build') {
          steps {
            bat 'docker run --rm -v "%WORKSPACE%\\frontend:/src:ro" node:22-alpine sh -c "mkdir /work && cp -r /src/. /work && cd /work && npm install --no-audit --no-fund && npm run build"'
          }
        }

        stage('ml-service') {
          steps {
            bat 'docker run --rm -v "%WORKSPACE%\\ml-service:/src:ro" python:3.14-slim sh -c "mkdir /work && cp -r /src/. /work && cd /work && pip install --no-cache-dir -q -r requirements-dev.txt && pytest -q"'
          }
        }
      }
    }

    stage('Build Images') {
      steps {
        withCredentials([file(credentialsId: 'student-performance-env', variable: 'ENV_FILE')]) {
          bat 'copy /Y "%ENV_FILE%" .env'
        }
        bat 'docker compose -f docker-compose.yml build --pull'
      }
    }

    stage('Deploy') {
      when {
        expression { ((env.BRANCH_NAME ?: env.GIT_BRANCH ?: '')).endsWith('main') }
      }
      steps {
        bat 'docker compose -f docker-compose.yml up -d --remove-orphans'
      }
    }

    stage('Smoke Test') {
      when {
        expression { ((env.BRANCH_NAME ?: env.GIT_BRANCH ?: '')).endsWith('main') }
      }
      steps {
        bat 'curl.exe -fsS --retry 10 --retry-delay 3 --retry-connrefused http://127.0.0.1:4000/healthz'
        bat 'curl.exe -fsS --retry 10 --retry-delay 3 --retry-connrefused http://127.0.0.1:4100/health'
        bat 'curl.exe -fsS --retry 10 --retry-delay 3 --retry-connrefused http://127.0.0.1:5000/health'
        bat 'curl.exe -fsS --retry 10 --retry-delay 3 --retry-connrefused http://127.0.0.1:5173/'
      }
    }
  }

  post {
    failure {
      bat(script: 'docker compose -f docker-compose.yml logs --tail=100', returnStatus: true)
    }
    always {
      bat(script: 'if exist .env del /q .env', returnStatus: true)
      cleanWs()
    }
  }
}