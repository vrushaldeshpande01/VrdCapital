output "cluster_role_arn"         { value = aws_iam_role.cluster.arn }
output "node_role_arn"            { value = aws_iam_role.node.arn }
output "jenkins_instance_profile" { value = aws_iam_instance_profile.jenkins.name }
output "jenkins_role_arn"         { value = aws_iam_role.jenkins.arn }
