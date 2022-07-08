FROM public.ecr.aws/lambda/provided:al2

# LAMBDA_TASK_ROOT is set by the lambda image
WORKDIR ${LAMBDA_TASK_ROOT}

COPY bootstrap function.sh ./

# we need to set this here so our bootstrap script works since images don't have handlers
ENV _HANDLER function.handler

ENTRYPOINT ["./bootstrap"]