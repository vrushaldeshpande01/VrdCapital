// VrdCapital — Root Orchestrator Pipeline
// Triggered by GitHub webhook on push to main.
// Detects which services changed and triggers their individual pipelines in parallel.
// Each service has its own Jenkinsfile at services/<name>/Jenkinsfile (or frontend/Jenkinsfile).

pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 45, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {

        stage('Detect Changed Services') {
            steps {
                script {
                    def changedFiles = sh(
                        script: 'git diff --name-only HEAD~1 HEAD || git diff --name-only HEAD',
                        returnStdout: true
                    ).trim().split('\n')

                    // Map folder prefix → Jenkins job name (create these jobs in Jenkins UI)
                    def serviceJobs = [
                        'services/auth-service'         : 'auth-service-pipeline',
                        'services/client-service'       : 'client-service-pipeline',
                        'services/portfolio-service'    : 'portfolio-service-pipeline',
                        'services/broker-service'       : 'broker-service-pipeline',
                        'services/order-service'        : 'order-service-pipeline',
                        'services/notification-service' : 'notification-service-pipeline',
                        'services/report-service'       : 'report-service-pipeline',
                        'frontend'                      : 'frontend-pipeline',
                    ]

                    env.JOBS_TO_TRIGGER = ''
                    serviceJobs.each { path, job ->
                        if (changedFiles.any { it.startsWith(path) }) {
                            env.JOBS_TO_TRIGGER += "${job},"
                        }
                    }

                    if (!env.JOBS_TO_TRIGGER) {
                        echo "No service changes detected — nothing to build"
                    } else {
                        echo "Triggering: ${env.JOBS_TO_TRIGGER}"
                    }
                }
            }
        }

        stage('Trigger Service Pipelines') {
            when {
                expression { env.JOBS_TO_TRIGGER?.trim() }
            }
            steps {
                script {
                    def jobs = env.JOBS_TO_TRIGGER.split(',').findAll { it }
                    def parallelBuilds = [:]

                    jobs.each { jobName ->
                        def job = jobName
                        parallelBuilds[job] = {
                            build(
                                job: job,
                                wait: true,
                                propagate: true,
                                parameters: [
                                    string(name: 'GIT_COMMIT', value: env.GIT_COMMIT)
                                ]
                            )
                        }
                    }

                    parallel parallelBuilds
                }
            }
        }
    }

    post {
        success { echo "All service pipelines completed successfully" }
        failure { echo "One or more service pipelines failed — check individual job logs" }
    }
}
