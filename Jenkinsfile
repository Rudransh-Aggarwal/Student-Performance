// Jenkinsfile (repo root): CI/CD with Docker Compose only (no Kubernetes).
// Required Jenkins plugins: Pipeline, Docker Pipeline, Credentials Binding, Workspace Cleanup.
// Required on the agent: Docker Engine, Docker Compose v2 plugin, curl.
// Required credential: "student-performance-env" (Secret file) = a copy of the root .env file.

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
          agent { docker { image 'node:22-alpine'; reuseNode true } }
          steps {
            dir('auth-service') {
              sh 'npm install --no-audit --no-fund'
              sh 'npm test'
            }
          }
        }

        stage('data-service') {
          agent { docker { image 'node:22-alpine'; reuseNode true } }
          steps {
            dir('data-service') {
              sh 'npm install --no-audit --no-fund'
              sh 'npm test'
            }
          }
        }

        stage('frontend-build') {
          agent { docker { image 'node:22-alpine'; reuseNode true } }
          steps {
            dir('frontend') {
              sh 'npm install --no-audit --no-fund'
              sh 'npm run build'
            }
          }
        }

        stage('ml-service') {
          agent { docker { image 'python:3.14-slim'; reuseNode true } }
          steps {
            dir('ml-service') {
              sh 'pip install --no-cache-dir -q -r requirements-dev.txt'
              sh 'pytest -q'
            }
          }
        }
      }
    }

    stage('Build Images') {
      steps {
        withCredentials([file(credentialsId: 'student-performance-env', variable: 'ENV_FILE')]) {
          sh 'cp "$ENV_FILE" .env && chmod 600 .env'
        }
        sh 'docker compose -f docker-compose.yml build --pull'
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      steps {
        sh 'docker compose -f docker-compose.yml up -d --remove-orphans'
      }
    }

    stage('Smoke Test') {
      when { branch 'main' }
      steps {
        sh '''
          set -e
          check() {
            curl -fsS --retry 10 --retry-delay 3 --retry-connrefused "$1" > /dev/null
            echo "OK: $1"
          }
          check http://127.0.0.1:4000/healthz
          check http://127.0.0.1:4100/health
          check http://127.0.0.1:5000/health
          check http://127.0.0.1:5173/
        '''
      }
    }
  }

  post {
    failure {
      sh 'docker compose -f docker-compose.yml logs --tail=100 || true'
    }
    always {
      sh 'rm -f .env || true'
      // Test containers run as root, so return file ownership to the Jenkins user before cleanup.
      sh 'docker run --rm -v "$WORKSPACE:/ws" alpine chown -R "$(id -u):$(id -g)" /ws || true'
      cleanWs()
    }
  }
}
